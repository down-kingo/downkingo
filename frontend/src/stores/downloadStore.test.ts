import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDownloadStore, Download, DownloadStatus } from "./downloadStore";

function mockDownload(overrides: Partial<Download> = {}): Download {
  return {
    id: "dl-1",
    url: "https://youtube.com/watch?v=test",
    title: "Test Video",
    thumbnail: "",
    duration: 120,
    uploader: "TestUser",
    format: "best",
    audioOnly: false,
    status: "pending" as DownloadStatus,
    progress: 0,
    speed: "",
    eta: "",
    filePath: "",
    fileSize: 0,
    errorMessage: "",
    createdAt: "2024-01-01T00:00:00Z",
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe("downloadStore", () => {
  beforeEach(() => {
    // Reset store state between tests
    const { result } = renderHook(() => useDownloadStore());
    act(() => {
      result.current.setQueue([]);
      result.current.setHistory([]);
      result.current.setLoading(false);
      result.current.setError(null);
    });
  });

  // ===========================================================================
  // Basic State Management
  // ===========================================================================

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useDownloadStore());
    expect(result.current.queue).toEqual([]);
    expect(result.current.history).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("setQueue replaces queue", () => {
    const { result } = renderHook(() => useDownloadStore());
    const downloads = [mockDownload({ id: "a" }), mockDownload({ id: "b" })];

    act(() => result.current.setQueue(downloads));

    expect(result.current.queue).toHaveLength(2);
    expect(result.current.queue[0].id).toBe("a");
  });

  it("setHistory replaces history", () => {
    const { result } = renderHook(() => useDownloadStore());
    const downloads = [mockDownload({ id: "h1", status: "completed" })];

    act(() => result.current.setHistory(downloads));

    expect(result.current.history).toHaveLength(1);
  });

  it("setLoading updates loading state", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.setLoading(true));
    expect(result.current.isLoading).toBe(true);

    act(() => result.current.setLoading(false));
    expect(result.current.isLoading).toBe(false);
  });

  it("setError updates error state", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.setError("Network error"));
    expect(result.current.error).toBe("Network error");

    act(() => result.current.setError(null));
    expect(result.current.error).toBeNull();
  });

  // ===========================================================================
  // addDownload
  // ===========================================================================

  it("addDownload adds to queue", () => {
    const { result } = renderHook(() => useDownloadStore());
    const download = mockDownload({ id: "new-dl" });

    act(() => result.current.addDownload(download));

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].id).toBe("new-dl");
  });

  it("addDownload prevents duplicates", () => {
    const { result } = renderHook(() => useDownloadStore());
    const download = mockDownload({ id: "dup" });

    act(() => result.current.addDownload(download));
    act(() => result.current.addDownload(download));

    expect(result.current.queue).toHaveLength(1);
  });

  it("addDownload allows different IDs", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() => result.current.addDownload(mockDownload({ id: "b" })));
    act(() => result.current.addDownload(mockDownload({ id: "c" })));

    expect(result.current.queue).toHaveLength(3);
  });

  // ===========================================================================
  // updateDownload
  // ===========================================================================

  it("updateDownload modifies existing download", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "upd" })));
    act(() =>
      result.current.updateDownload("upd", {
        status: "downloading",
        progress: 50,
        speed: "5 MB/s",
      })
    );

    expect(result.current.queue[0].status).toBe("downloading");
    expect(result.current.queue[0].progress).toBe(50);
    expect(result.current.queue[0].speed).toBe("5 MB/s");
  });

  it("updateDownload does not affect other downloads", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() => result.current.addDownload(mockDownload({ id: "b" })));
    act(() =>
      result.current.updateDownload("a", { progress: 75 })
    );

    expect(result.current.queue[0].progress).toBe(75);
    expect(result.current.queue[1].progress).toBe(0);
  });

  it("updateDownload ignores non-existent ID", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() =>
      result.current.updateDownload("non-existent", { progress: 100 })
    );

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].progress).toBe(0);
  });

  // ===========================================================================
  // completeDownload
  // ===========================================================================

  it("completeDownload moves from queue to history", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() =>
      result.current.addDownload(
        mockDownload({ id: "done", status: "completed" })
      )
    );

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.history).toHaveLength(0);

    act(() => result.current.completeDownload("done"));

    expect(result.current.queue).toHaveLength(0);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].id).toBe("done");
  });

  it("completeDownload prevents duplicate history entries", () => {
    const { result } = renderHook(() => useDownloadStore());

    const download = mockDownload({ id: "dedup", status: "completed" });

    // Add to both queue and history
    act(() => result.current.addDownload(download));
    act(() => result.current.setHistory([download]));

    // Complete should remove from queue but not duplicate in history
    act(() => result.current.completeDownload("dedup"));

    expect(result.current.queue).toHaveLength(0);
    expect(result.current.history).toHaveLength(1);
  });

  it("completeDownload is no-op for non-existent ID", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() => result.current.completeDownload("non-existent"));

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.history).toHaveLength(0);
  });

  it("completeDownload prepends to history (newest first)", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => {
      result.current.setHistory([
        mockDownload({ id: "old", title: "Old Video" }),
      ]);
    });
    act(() =>
      result.current.addDownload(mockDownload({ id: "new", title: "New Video" }))
    );
    act(() => result.current.completeDownload("new"));

    expect(result.current.history[0].id).toBe("new");
    expect(result.current.history[1].id).toBe("old");
  });

  // ===========================================================================
  // removeFromQueue
  // ===========================================================================

  it("removeFromQueue removes by ID", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() => result.current.addDownload(mockDownload({ id: "b" })));
    act(() => result.current.removeFromQueue("a"));

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].id).toBe("b");
  });

  it("removeFromQueue is no-op for non-existent ID", () => {
    const { result } = renderHook(() => useDownloadStore());

    act(() => result.current.addDownload(mockDownload({ id: "a" })));
    act(() => result.current.removeFromQueue("non-existent"));

    expect(result.current.queue).toHaveLength(1);
  });
});
