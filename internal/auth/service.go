package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"kingo/internal/logger"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Configuração do GitHub App
// GitHub Apps com Device Flow NÃO requerem client_secret (seguro para open source)
// Device Flow habilitado nas configurações do App
const ClientID = "Iv23liJjoBb3O4FatgRC"

type AuthService struct {
	configDir string
	Token     string
}

type DeviceCodeResponse struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	Scope       string `json:"scope"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

func NewAuthService(configDir string) *AuthService {
	authDir := filepath.Join(configDir, "auth")
	if err := os.MkdirAll(authDir, 0755); err != nil {
		logger.Log.Warn().Err(err).Str("dir", authDir).Msg("failed to create auth directory")
	}

	s := &AuthService{
		configDir: authDir,
	}
	s.LoadToken()
	return s
}

// StartDeviceFlow inicia o Device Flow e retorna o código para o usuário
func (s *AuthService) StartDeviceFlow() (*DeviceCodeResponse, error) {
	data := url.Values{}
	data.Set("client_id", ClientID)
	data.Set("scope", "read:project,public_repo,user:email") // Explicit scopes to match App permissions

	req, err := http.NewRequest("POST", "https://github.com/login/device/code", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github api error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result DeviceCodeResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w - body: %s", err, string(bodyBytes))
	}

	if result.UserCode == "" {
		return nil, fmt.Errorf("empty user_code in response: %s", string(bodyBytes))
	}

	return &result, nil
}

// PollToken faz polling até o usuário autorizar ou timeout
func (s *AuthService) PollToken(deviceCode string, interval int) (string, error) {
	if interval < 5 {
		interval = 5 // GitHub exige mínimo 5s
	}

	timeout := time.After(15 * time.Minute) // Timeout generoso

	// Polling loop
	for {
		// Check token
		token, err := s.checkToken(deviceCode)
		if err != nil {
			errStr := err.Error()
			// Continua polling se ainda está pendente
			if strings.Contains(errStr, "authorization_pending") || strings.Contains(errStr, "slow_down") {
				// Aguarda intervalo antes de tentar novamente
				select {
				case <-timeout:
					return "", fmt.Errorf("timeout: authorization took too long")
				case <-time.After(time.Duration(interval) * time.Second):
					continue
				}
			}
			return "", err
		}
		if token != "" {
			s.SaveToken(token)
			return token, nil
		}

		// Aguarda intervalo
		select {
		case <-timeout:
			return "", fmt.Errorf("timeout: authorization took too long")
		case <-time.After(time.Duration(interval) * time.Second):
			// Continua loop
		}
	}
}

func (s *AuthService) checkToken(deviceCode string) (string, error) {
	data := url.Values{}
	data.Set("client_id", ClientID)
	data.Set("device_code", deviceCode)
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

	req, _ := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("network error: %w", err)
	}
	defer resp.Body.Close()

	var result TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("oauth error: %s", result.Error)
	}

	// Log scopes for debugging (GitHub Apps often return empty scopes, which is normal)
	logger.Log.Debug().
		Str("scopes", result.Scope).
		Msg("GitHub token received")

	return result.AccessToken, nil
}

// SaveToken persists the token to disk
func (s *AuthService) SaveToken(token string) {
	s.Token = token
	data := map[string]string{"access_token": token}
	file, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		logger.Log.Error().Err(err).Msg("failed to marshal auth token")
		return
	}
	if err := os.WriteFile(filepath.Join(s.configDir, "session.json"), file, 0600); err != nil {
		logger.Log.Error().Err(err).Msg("failed to save auth token")
	}
}

// LoadToken loads persisted token from disk
func (s *AuthService) LoadToken() {
	file, err := os.ReadFile(filepath.Join(s.configDir, "session.json"))
	if err != nil {
		return // File doesn't exist or can't be read
	}
	var data map[string]string
	if json.Unmarshal(file, &data) == nil {
		s.Token = data["access_token"]
	}
}

func (s *AuthService) Logout() {
	s.Token = ""
	os.Remove(filepath.Join(s.configDir, "session.json"))
}
