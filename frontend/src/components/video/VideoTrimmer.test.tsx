import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  GetVideoSubtitles,
  ListWhisperModels,
} from "../../../bindings/kingo/app";
import VideoTrimmer from "./VideoTrimmer";
import {
  createDefaultCaptionOptions,
  type CaptionOptions,
} from "./captions";

vi.mock("../../../bindings/kingo/app", () => ({
  GetVideoSubtitles: vi.fn(() => Promise.resolve({ cues: [] })),
  ListWhisperModels: vi.fn(() => Promise.resolve([])),
}));

function CaptionHarness() {
  const [captions, setCaptions] = useState<CaptionOptions>(() =>
    createDefaultCaptionOptions(),
  );
  return (
    <VideoTrimmer
      videoUrl="preview.mp4"
      sourceUrl="https://youtube.com/watch?v=captions"
      duration={60}
      trimEnabled
      onCutsChange={vi.fn()}
      onTrimToggle={vi.fn()}
      captions={captions}
      onCaptionsChange={setCaptions}
      subtitleLanguages={[
        { code: "pt-BR", name: "Português", source: "manual" },
      ]}
      videoLanguage="pt-BR"
    />
  );
}

describe("VideoTrimmer timeline editing", () => {
  it("moves the playhead with transport controls and zooms the timeline", () => {
    render(
      <VideoTrimmer
        videoUrl=""
        duration={60}
        trimEnabled
        onCutsChange={vi.fn()}
        onTrimToggle={vi.fn()}
        captions={createDefaultCaptionOptions()}
        onCaptionsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("trimmer.open_editor"));
    expect(
      within(screen.getByRole("toolbar")).getByRole("button", {
        name: "trimmer.previous_edit",
      }).parentElement,
    ).toHaveTextContent("Ctrl + ←");
    fireEvent.click(screen.getByTitle("trimmer.forward_five"));
    expect(screen.getByLabelText("trimmer.playhead_time")).toHaveValue("0:05");
    fireEvent.click(screen.getByRole("button", { name: "trimmer.split" }));
    expect(screen.getByText("trimmer.clip 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "trimmer.zoom_in" }));
    expect(screen.getByText("2×")).toBeInTheDocument();
  });

  it("splits at the playhead, removes a clip, and restores it with undo", async () => {
    const onCutsChange = vi.fn();
    render(
      <VideoTrimmer
        videoUrl=""
        duration={60}
        trimEnabled
        onCutsChange={onCutsChange}
        onTrimToggle={vi.fn()}
        captions={createDefaultCaptionOptions()}
        onCaptionsChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("trimmer.open_editor"));
    const timeInput = screen.getByLabelText("trimmer.playhead_time");
    fireEvent.change(timeInput, { target: { value: "0:10" } });
    fireEvent.keyDown(timeInput, { key: "Enter" });

    fireEvent.click(screen.getByRole("button", { name: "trimmer.split_at_playhead" }));
    expect(screen.getByText("trimmer.clip 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "trimmer.delete_clip" }));
    await waitFor(() =>
      expect(onCutsChange).toHaveBeenLastCalledWith([{ start: 10, end: 60 }]),
    );
    expect(screen.queryByText("trimmer.clip 2")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "trimmer.undo" }));
    await waitFor(() => expect(onCutsChange).toHaveBeenLastCalledWith([]));
    expect(screen.getByText("trimmer.clip 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "trimmer.redo" }));
    await waitFor(() =>
      expect(onCutsChange).toHaveBeenLastCalledWith([{ start: 10, end: 60 }]),
    );
    expect(screen.queryByText("trimmer.clip 2")).not.toBeInTheDocument();
  });

  it("imports, edits, and previews styled captions", async () => {
    vi.mocked(ListWhisperModels).mockResolvedValueOnce([] as never);
    vi.mocked(GetVideoSubtitles).mockResolvedValueOnce({
      cues: [{ start: 0, end: 5, text: "Olá mundo" }],
      language: "pt-BR",
      source: "manual",
    } as never);

    render(<CaptionHarness />);
    fireEvent.click(screen.getByText("trimmer.add_captions"));

    const cue = await screen.findByLabelText("trimmer.caption_cue 1");
    expect(cue).toHaveValue("Olá mundo");
    const preview = screen
      .getAllByText("Olá mundo")
      .find((element) => element.classList.contains("max-w-full"));
    expect(preview).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Arial"), {
      target: { value: "Impact" },
    });
    expect(preview).toHaveStyle({
      fontFamily: "Impact",
    });

    fireEvent.change(cue, { target: { value: "Texto revisado" } });
    await waitFor(() =>
      expect(
        screen
          .getAllByText("Texto revisado")
          .find((element) => element.classList.contains("max-w-full")),
      ).toBeInTheDocument(),
    );
  });

  it("does not replace Whisper mode with a late YouTube response", async () => {
    let resolveRequest: ((value: unknown) => void) | undefined;
    vi.mocked(GetVideoSubtitles).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    render(<CaptionHarness />);
    fireEvent.click(screen.getByText("trimmer.add_captions"));

    const source = screen.getByLabelText("trimmer.caption_generation");
    fireEvent.change(source, { target: { value: "whisper" } });
    expect(source).toHaveValue("whisper");

    resolveRequest?.({
      cues: [{ start: 0, end: 5, text: "Resposta atrasada" }],
      language: "pt-BR",
      source: "manual",
    });

    await waitFor(() => {
      expect(source).toHaveValue("whisper");
      expect(screen.queryByText("Resposta atrasada")).not.toBeInTheDocument();
    });
  });
});
