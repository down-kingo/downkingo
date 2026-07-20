package youtube

import (
	"slices"
	"testing"
)

func TestPlaylistInfoArgsOnlyAddsCookiesForAuthenticatedRetry(t *testing.T) {
	url := "https://www.instagram.com/stories/neymarjr/"

	publicArgs := playlistInfoArgs(url, "")
	if slices.Contains(publicArgs, "--cookies-from-browser") {
		t.Fatal("public playlist extraction unexpectedly reads browser cookies")
	}
	if publicArgs[len(publicArgs)-1] != url {
		t.Fatalf("public URL must be the final argument, got %q", publicArgs[len(publicArgs)-1])
	}

	authenticatedArgs := playlistInfoArgs(url, "brave")
	index := slices.Index(authenticatedArgs, "--cookies-from-browser")
	if index < 0 || index+1 >= len(authenticatedArgs) || authenticatedArgs[index+1] != "brave" {
		t.Fatalf("authenticated args do not contain the selected browser: %#v", authenticatedArgs)
	}
	if authenticatedArgs[len(authenticatedArgs)-1] != url {
		t.Fatalf("authenticated URL must be the final argument, got %q", authenticatedArgs[len(authenticatedArgs)-1])
	}
}
