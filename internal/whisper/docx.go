package whisper

import (
	"archive/zip"
	"fmt"
	"os"
	"strings"
)

var xmlEscaper = strings.NewReplacer(
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	`"`, "&quot;",
	"'", "&apos;",
)

const docxContentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const docxRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

const docxDocRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`

// GenerateDOCX creates a minimal .docx file from plain text.
func GenerateDOCX(text string, savePath string) error {
	f, err := os.Create(savePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer f.Close()

	zw := zip.NewWriter(f)

	parts := []struct {
		name    string
		content string
	}{
		{"[Content_Types].xml", docxContentTypes},
		{"_rels/.rels", docxRels},
		{"word/_rels/document.xml.rels", docxDocRels},
		{"word/document.xml", buildDocumentXML(text)},
	}

	for _, p := range parts {
		if err := writeDocxPart(zw, p.name, p.content); err != nil {
			zw.Close()
			return fmt.Errorf("failed to write %s: %w", p.name, err)
		}
	}

	return zw.Close()
}

func writeDocxPart(zw *zip.Writer, name, content string) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write([]byte(content))
	return err
}

func buildDocumentXML(text string) string {
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	sb.WriteString("\n")
	sb.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`)
	sb.WriteString("\n<w:body>\n")

	lines := strings.Split(text, "\n")
	for _, line := range lines {
		line = strings.TrimRight(line, "\r")
		escaped := xmlEscaper.Replace(line)
		if escaped == "" {
			sb.WriteString("  <w:p/>\n")
		} else {
			fmt.Fprintf(&sb, "  <w:p><w:r><w:rPr><w:rFonts w:ascii=\"Calibri\" w:hAnsi=\"Calibri\"/><w:sz w:val=\"22\"/></w:rPr><w:t xml:space=\"preserve\">%s</w:t></w:r></w:p>\n", escaped)
		}
	}

	sb.WriteString("</w:body>\n</w:document>")
	return sb.String()
}
