import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Images from "./Images";

const appMocks = vi.hoisted(() => ({
  addToQueueAdvanced: vi.fn(),
  downloadImageAdvanced: vi.fn(),
  getImageInfo: vi.fn(),
  getInstagramCarousel: vi.fn(),
  getInstagramCarouselWithCookies: vi.fn(),
}));

vi.mock("../../bindings/kingo/app", () => ({
  AddToQueueAdvanced: appMocks.addToQueueAdvanced,
  DownloadImageAdvanced: appMocks.downloadImageAdvanced,
  GetImageInfo: appMocks.getImageInfo,
  GetInstagramCarousel: appMocks.getInstagramCarousel,
  GetInstagramCarouselWithCookies:
    appMocks.getInstagramCarouselWithCookies,
}));

describe("Instagram Stories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMocks.getInstagramCarousel.mockRejectedValue(
      new Error("O Instagram exige uma sessão autenticada para acessar Stories"),
    );
    appMocks.getInstagramCarouselWithCookies.mockResolvedValue({
      mediaItems: [
        {
          url: "https://scontent.cdninstagram.com/story.mp4?token=1",
          type: "video",
          width: 1080,
          height: 1920,
          cookieBrowser: "brave",
        },
      ],
    });
    appMocks.addToQueueAdvanced.mockResolvedValue(undefined);
  });

  it("requests a browser session and keeps it for the Story download", async () => {
    render(
      <Images
        embedded
        initialUrl="https://www.instagram.com/stories/neymarjr/"
      />,
    );

    expect(await screen.findByText("story_auth.title")).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", { name: "story_auth.use_browser" })[3],
    );
    await waitFor(() =>
      expect(appMocks.getInstagramCarouselWithCookies).toHaveBeenCalledWith(
        "https://www.instagram.com/stories/neymarjr/",
        "brave",
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "download_selected" }),
    );
    await waitFor(() =>
      expect(appMocks.addToQueueAdvanced).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://scontent.cdninstagram.com/story.mp4?token=1",
          cookieBrowser: "brave",
        }),
      ),
    );
  });
});
