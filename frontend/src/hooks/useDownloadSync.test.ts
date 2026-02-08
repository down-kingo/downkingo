import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Wails runtime
vi.mock("../lib/wailsRuntime", () => ({
  safeEventsOn: vi.fn(() => Promise.resolve(() => {})),
  tryEventsOff: vi.fn(),
}));

// Mock Wails App bindings
vi.mock("../../bindings/kingo/app", () => ({
  GetDownloadQueue: vi.fn(() => Promise.resolve([])),
  GetDownloadHistory: vi.fn(() => Promise.resolve([])),
  AddToQueue: vi.fn(() =>
    Promise.resolve({ id: "test-id", url: "https://test.com" })
  ),
  AddToQueueAdvanced: vi.fn(() =>
    Promise.resolve({ id: "test-id", url: "https://test.com" })
  ),
  CancelDownload: vi.fn(() => Promise.resolve()),
  ClearDownloadHistory: vi.fn(() => Promise.resolve()),
}));

// Mock download store
const mockStore = {
  setQueue: vi.fn(),
  setHistory: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  addDownload: vi.fn(),
  updateDownload: vi.fn(),
  completeDownload: vi.fn(),
};

vi.mock("../stores/downloadStore", () => ({
  useDownloadStore: () => mockStore,
}));

// Import hooks after mocks are set up
import { useDownloadActions } from "./useDownloadActions";
import { useDownloadSync } from "./useDownloadSync";
import {
  GetDownloadQueue,
  GetDownloadHistory,
  AddToQueue,
  CancelDownload,
  ClearDownloadHistory,
} from "../../bindings/kingo/app";

describe("useDownloadActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads initial data on call", async () => {
    const { result } = renderHook(() => useDownloadActions());

    await act(async () => {
      await result.current.loadInitialData();
    });

    expect(GetDownloadQueue).toHaveBeenCalled();
    expect(GetDownloadHistory).toHaveBeenCalledWith(50);
    expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    expect(mockStore.setLoading).toHaveBeenCalledWith(false);
  });

  it("addToQueue calls backend and returns download", async () => {
    const { result } = renderHook(() => useDownloadActions());

    let download;
    await act(async () => {
      download = await result.current.addToQueue(
        "https://youtube.com/test",
        "720p",
        false
      );
    });

    expect(AddToQueue).toHaveBeenCalledWith(
      "https://youtube.com/test",
      "720p",
      false
    );
    expect(download).toHaveProperty("id", "test-id");
  });

  it("cancelDownload calls backend", async () => {
    const { result } = renderHook(() => useDownloadActions());

    await act(async () => {
      await result.current.cancelDownload("test-id");
    });

    expect(CancelDownload).toHaveBeenCalledWith("test-id");
  });

  it("clearHistory calls backend and updates store", async () => {
    const { result } = renderHook(() => useDownloadActions());

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(ClearDownloadHistory).toHaveBeenCalled();
    expect(mockStore.setHistory).toHaveBeenCalledWith([]);
  });

  it("handles errors and sets error state", async () => {
    const error = new Error("Network error");
    vi.mocked(AddToQueue).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useDownloadActions());

    await expect(
      act(async () => {
        await result.current.addToQueue("https://test.com");
      })
    ).rejects.toThrow();

    expect(mockStore.setError).toHaveBeenCalled();
  });
});

describe("useDownloadSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes action functions", () => {
    const { result } = renderHook(() => useDownloadSync());

    expect(result.current).toHaveProperty("addToQueue");
    expect(result.current).toHaveProperty("addToQueueAdvanced");
    expect(result.current).toHaveProperty("cancelDownload");
    expect(result.current).toHaveProperty("refresh");
    expect(result.current).toHaveProperty("clearHistory");
  });

  it("loads initial data on mount", async () => {
    renderHook(() => useDownloadSync());

    await waitFor(() => {
      expect(GetDownloadQueue).toHaveBeenCalled();
    });
  });
});
