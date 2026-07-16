package whisper

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"kingo/internal/logger"
)

const whisperModelsRevision = "5359861c739e955e79d9a303bcbc70fb988958b1"
const vadModelsRevision = "9ffd54a1e1ee413ddf265af9913beaf518d1639b"

type modelSpec struct {
	Name        string
	FileName    string
	Size        string
	Bytes       int64
	Description string
	SHA256      string
}

var supportedModels = []modelSpec{
	{Name: "tiny", FileName: "ggml-tiny.bin", Size: "~75 MB", Bytes: 77691713, Description: "Fastest, basic quality", SHA256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21"},
	{Name: "base", FileName: "ggml-base.bin", Size: "~150 MB", Bytes: 147951465, Description: "Fast, good quality", SHA256: "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"},
	{Name: "small-q5_1", FileName: "ggml-small-q5_1.bin", Size: "~190 MB", Bytes: 190085487, Description: "Efficient quality with lower memory use", SHA256: "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb"},
	{Name: "small", FileName: "ggml-small.bin", Size: "~500 MB", Bytes: 487601967, Description: "Medium speed, very good quality", SHA256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b"},
	{Name: "medium-q5_0", FileName: "ggml-medium-q5_0.bin", Size: "~540 MB", Bytes: 539212467, Description: "Excellent quality with lower memory use", SHA256: "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f"},
	{Name: "medium", FileName: "ggml-medium.bin", Size: "~1.5 GB", Bytes: 1533763059, Description: "Slow, excellent quality", SHA256: "6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208"},
	{Name: "large-v3-turbo-q5_0", FileName: "ggml-large-v3-turbo-q5_0.bin", Size: "~575 MB", Bytes: 574041195, Description: "Best quality/speed ratio with lower memory use", SHA256: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2"},
	{Name: "large-v3-turbo", FileName: "ggml-large-v3-turbo.bin", Size: "~1.6 GB", Bytes: 1624555275, Description: "Best quality/speed ratio", SHA256: "1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69"},
}

var vadModel = modelSpec{
	Name: "silero-v6.2.0", FileName: "ggml-silero-v6.2.0.bin", Size: "~900 KB", Bytes: 885098,
	Description: "Silero voice activity detection", SHA256: "2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987",
}

func findModelSpec(name string) (modelSpec, bool) {
	for _, spec := range supportedModels {
		if spec.Name == name {
			return spec, true
		}
	}
	return modelSpec{}, false
}

func (c *Client) GetAvailableModels() []AvailableModel {
	models := make([]AvailableModel, 0, len(supportedModels))
	for _, spec := range supportedModels {
		models = append(models, AvailableModel{Name: spec.Name, Size: spec.Size, Description: spec.Description})
	}
	return models
}

func (c *Client) ListModels() ([]ModelInfo, error) {
	if err := c.EnsureDirectories(); err != nil {
		return nil, err
	}
	models := make([]ModelInfo, 0, len(supportedModels))
	for _, spec := range supportedModels {
		path := filepath.Join(c.modelsDir, spec.FileName)
		info, err := os.Stat(path)
		if err != nil || info.IsDir() || info.Size() != spec.Bytes {
			continue
		}
		models = append(models, ModelInfo{Name: spec.Name, Size: info.Size(), Path: path})
	}
	return models, nil
}

func (c *Client) DownloadModel(modelName string) error {
	spec, ok := findModelSpec(modelName)
	if !ok {
		return fmt.Errorf("unsupported whisper model: %s", modelName)
	}
	if err := c.EnsureDirectories(); err != nil {
		return err
	}
	destination := filepath.Join(c.modelsDir, spec.FileName)
	if err := verifyInstalledModel(destination, spec); err == nil {
		return nil
	}
	url := fmt.Sprintf("https://huggingface.co/ggerganov/whisper.cpp/resolve/%s/%s", whisperModelsRevision, spec.FileName)
	return c.downloadModelFile(spec, url, destination, "whisper:model-progress")
}

func (c *Client) DeleteModel(modelName string) error {
	spec, ok := findModelSpec(modelName)
	if !ok {
		return fmt.Errorf("unsupported whisper model: %s", modelName)
	}
	if err := os.Remove(filepath.Join(c.modelsDir, spec.FileName)); err != nil && !os.IsNotExist(err) {
		return err
	}
	_ = os.Remove(modelVerificationPath(filepath.Join(c.modelsDir, spec.FileName)))
	logger.Log.Info().Str("model", modelName).Msg("whisper model deleted")
	return nil
}

func (c *Client) ensureVADModel() (string, error) {
	if err := c.EnsureDirectories(); err != nil {
		return "", err
	}
	destination := filepath.Join(c.modelsDir, vadModel.FileName)
	if err := verifyInstalledModel(destination, vadModel); err == nil {
		return destination, nil
	}
	url := fmt.Sprintf("https://huggingface.co/ggml-org/whisper-vad/resolve/%s/%s", vadModelsRevision, vadModel.FileName)
	if err := c.downloadModelFile(vadModel, url, destination, "whisper:vad-progress"); err != nil {
		return "", err
	}
	return destination, nil
}

func (c *Client) downloadModelFile(spec modelSpec, url, destination, eventName string) error {
	req, err := http.NewRequestWithContext(c.baseContext(), http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := (&http.Client{Timeout: 60 * time.Minute}).Do(req)
	if err != nil {
		return fmt.Errorf("model download failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("model download returned HTTP %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp(c.modelsDir, ".model-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	ok := false
	defer func() {
		_ = tmp.Close()
		if !ok {
			_ = os.Remove(tmpPath)
		}
	}()

	hash := sha256.New()
	buf := make([]byte, 64*1024)
	var downloaded int64
	c.emitEvent(eventName, map[string]interface{}{"model": spec.Name, "status": "downloading", "percent": 0})
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, err := tmp.Write(buf[:n]); err != nil {
				return err
			}
			_, _ = hash.Write(buf[:n])
			downloaded += int64(n)
			if spec.Bytes > 0 {
				c.emitEvent(eventName, map[string]interface{}{"model": spec.Name, "status": "downloading", "percent": float64(downloaded) / float64(spec.Bytes) * 100, "downloaded": downloaded, "total": spec.Bytes})
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if downloaded != spec.Bytes {
		return fmt.Errorf("model size mismatch: got %d, expected %d", downloaded, spec.Bytes)
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, spec.SHA256) {
		return fmt.Errorf("model checksum mismatch: got %s", actual)
	}
	if err := os.Remove(destination); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(tmpPath, destination); err != nil {
		return err
	}
	ok = true
	if err := writeModelVerification(destination, spec); err != nil {
		_ = os.Remove(destination)
		return fmt.Errorf("could not persist model verification: %w", err)
	}
	c.emitEvent(eventName, map[string]interface{}{"model": spec.Name, "status": "complete", "percent": 100})
	logger.Log.Info().Str("model", spec.Name).Str("sha256", actual).Msg("verified whisper model installed")
	return nil
}

type modelVerification struct {
	SHA256      string `json:"sha256"`
	Size        int64  `json:"size"`
	ModTimeNano int64  `json:"modTimeNano"`
}

func modelVerificationPath(modelPath string) string {
	return modelPath + ".verified.json"
}

func verifyInstalledModel(modelPath string, spec modelSpec) error {
	info, err := os.Stat(modelPath)
	if err != nil || info.IsDir() || info.Size() != spec.Bytes {
		return fmt.Errorf("model is missing or has an unexpected size")
	}
	var verification modelVerification
	if data, readErr := os.ReadFile(modelVerificationPath(modelPath)); readErr == nil {
		if json.Unmarshal(data, &verification) == nil &&
			strings.EqualFold(verification.SHA256, spec.SHA256) &&
			verification.Size == info.Size() && verification.ModTimeNano == info.ModTime().UnixNano() {
			return nil
		}
	}

	file, err := os.Open(modelPath)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(hash, file)
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	actual := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(actual, spec.SHA256) {
		return fmt.Errorf("model checksum mismatch: got %s", actual)
	}
	return writeModelVerification(modelPath, spec)
}

func writeModelVerification(modelPath string, spec modelSpec) error {
	info, err := os.Stat(modelPath)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(modelVerification{SHA256: spec.SHA256, Size: info.Size(), ModTimeNano: info.ModTime().UnixNano()})
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(modelPath), ".verification-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := tmp.Write(payload); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	verificationPath := modelVerificationPath(modelPath)
	_ = os.Remove(verificationPath)
	return os.Rename(tmpPath, verificationPath)
}
