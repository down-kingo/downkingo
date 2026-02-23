package main

import (
	"embed"
	"fmt"
	"os"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

//go:embed VERSION
var versionFile string

func main() {
	// Set version from embedded VERSION file if not overridden by ldflags
	if Version == "" {
		Version = strings.TrimSpace(versionFile)
	}

	// Create an instance of the app structure
	appInstance := NewApp(appIcon)

	// Create application with options
	app := application.New(application.Options{
		Name: "DownKingo",
		Icon: appIcon,
		Services: []application.Service{
			application.NewService(appInstance),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:                  "DownKingo",
		Width:                  1280,
		Height:                 800,
		BackgroundColour:       application.NewRGB(255, 255, 255),
		DevToolsEnabled:        devTools,
		OpenInspectorOnStartup: devTools,
	})

	if err := app.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
