import {
  IconArrowUpRight,
  IconHeart,
  IconHeartHandshake,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import donationVideoUrl from "../assets/images/Personagem_pede_doação_elegante_ingles.webm";
import donationAudioEnUrl from "../assets/images/voz-en-bt.mp3";
import donationAudioPtUrl from "../assets/images/voz-pt-bt.mp3";
import { safeBrowserOpenURL } from "../lib/wailsRuntime";
import { useSettingsStore } from "../stores/settingsStore";

export const DONATION_URL = "https://github.com/sponsors/Capman002/";
const DONATION_HOVER_DURATION = 900;

interface DonationBannerProps {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  variant?: "compact" | "header" | "wide" | "rail" | "subtle";
}

export default function DonationBanner(props: DonationBannerProps) {
  const showDonationBanners = useSettingsStore(
    (state) => state.showDonationBanners !== false,
  );

  if (!showDonationBanners) return null;

  return <DonationBannerContent {...props} />;
}

function DonationBannerContent({
  eyebrow,
  title,
  description,
  action,
  variant = "wide",
}: DonationBannerProps) {
  const { i18n } = useTranslation();
  const [isDonationHovered, setIsDonationHovered] = useState(false);
  const [isDonationVideoOpen, setIsDonationVideoOpen] = useState(false);
  const donationHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const donationVideoRef = useRef<HTMLVideoElement | null>(null);
  const donationLanguage =
    i18n?.resolvedLanguage ?? i18n?.language ?? "en-US";
  const donationAudioUrl =
    donationLanguage === "pt-BR"
      ? donationAudioPtUrl
      : donationLanguage === "en-US"
        ? donationAudioEnUrl
        : null;
  const handleDonate = () => safeBrowserOpenURL(DONATION_URL);

  const closeDonationMedia = () => {
    setIsDonationVideoOpen(false);
    setIsDonationHovered(false);
  };

  const stopDonationHover = () => {
    if (donationHoverTimer.current) {
      clearTimeout(donationHoverTimer.current);
      donationHoverTimer.current = null;
    }
    setIsDonationHovered(false);
  };

  const startDonationHover = () => {
    if (isDonationVideoOpen || isDonationHovered) return;

    setIsDonationHovered(true);
    donationHoverTimer.current = setTimeout(() => {
      donationHoverTimer.current = null;
      setIsDonationVideoOpen(true);
    }, DONATION_HOVER_DURATION);
  };

  useEffect(
    () => () => {
      if (donationHoverTimer.current) clearTimeout(donationHoverTimer.current);
    },
    [],
  );

  if (variant === "rail") {
    return (
      <aside
        aria-label={title}
        className="group relative h-full min-h-64 overflow-hidden rounded-2xl bg-white/[0.025] px-3 py-5 text-center shadow-sm ring-1 ring-surface-900/[0.06] backdrop-blur-[2px] dark:bg-white/[0.018] dark:ring-white/[0.07]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
        <div className="donation-lamination pointer-events-none absolute -inset-y-8 w-14 opacity-35" />
        <IconHeart
          aria-hidden="true"
          size={88}
          stroke={0.9}
          className="absolute -bottom-5 -right-5 rotate-[-12deg] fill-primary-500/[0.025] text-primary-500/10"
        />

        <div className="relative flex h-full min-h-56 flex-col items-center justify-center">
          <IconHeartHandshake
            aria-hidden="true"
            size={21}
            stroke={1.35}
            className="mb-3 text-surface-400 transition-colors group-hover:text-primary-500"
          />
          <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-surface-400">
            {eyebrow}
          </p>
          <h3 className="mt-2 font-display text-[12px] font-semibold leading-snug text-surface-700 dark:text-surface-600">
            {title}
          </h3>
          <p className="mt-2 line-clamp-3 text-[9px] leading-relaxed text-surface-400">
            {description}
          </p>
          <button
            type="button"
            onClick={handleDonate}
            className="mt-4 inline-flex items-center gap-1 rounded-lg border border-surface-300/70 bg-transparent px-3 py-1.5 text-[9px] font-bold text-surface-600 transition-colors hover:border-primary-500/40 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:border-white/10 dark:text-surface-400"
          >
            {action}
            <IconArrowUpRight aria-hidden="true" size={11} />
          </button>
        </div>
      </aside>
    );
  }

  if (variant === "subtle") {
    return (
      <aside
        aria-label={title}
        className="group relative overflow-hidden rounded-xl bg-white/[0.025] px-4 py-3 shadow-sm ring-1 ring-surface-900/[0.06] backdrop-blur-[2px] dark:bg-white/[0.018] dark:ring-white/[0.07]"
      >
        <div className="absolute inset-y-0 left-0 w-0.5 bg-primary-500/35" />
        <div className="donation-lamination pointer-events-none absolute -inset-y-8 w-16 opacity-30" />
        <IconHeart
          aria-hidden="true"
          size={58}
          stroke={0.9}
          className="absolute -bottom-5 right-16 rotate-[-10deg] fill-primary-500/[0.025] text-primary-500/10"
        />

        <div className="relative flex items-center gap-3">
          <IconHeartHandshake
            aria-hidden="true"
            size={19}
            stroke={1.35}
            className="shrink-0 text-surface-400 transition-colors group-hover:text-primary-500"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-surface-400">
              {eyebrow}
            </p>
            <h3 className="mt-0.5 truncate font-display text-[11px] font-semibold text-surface-700 dark:text-surface-600">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleDonate}
            aria-label={action}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-surface-300/70 bg-transparent px-3 py-1.5 text-[9px] font-bold text-surface-600 transition-colors hover:border-primary-500/40 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:border-white/10 dark:text-surface-400"
          >
            {action}
            <IconArrowUpRight aria-hidden="true" size={11} />
          </button>
        </div>
      </aside>
    );
  }

  if (variant === "compact") {
    return (
      <aside
        aria-label={title}
        className="relative overflow-hidden rounded-xl bg-white p-4 text-zinc-900 shadow-sm ring-1 ring-surface-200/80 dark:bg-surface-100 dark:text-surface-900 dark:ring-white/10"
      >
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-rose-100/70 blur-2xl dark:bg-rose-500/10" />
        <IconHeart
          aria-hidden="true"
          size={82}
          stroke={1}
          className="absolute -bottom-6 -right-4 rotate-[-12deg] fill-rose-100/70 text-rose-300/60 dark:fill-rose-500/10 dark:text-rose-400/20"
        />
        <div className="relative">
          <h3 className="font-display text-[15px] font-bold leading-tight text-zinc-900 dark:text-surface-900">
            {title}
          </h3>
          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-500 dark:text-surface-500">
            {description}
          </p>

          <button
            type="button"
            onClick={handleDonate}
            className="group mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-[10px] font-extrabold text-white shadow-sm shadow-emerald-900/10 transition-all hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-100"
          >
            {action}
            <IconArrowUpRight
              size={13}
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </aside>
    );
  }

  if (variant === "header") {
    return (
      <>
        {createPortal(
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 z-[9998] overflow-hidden transition-opacity duration-500 ${
              isDonationHovered ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="donation-screen-glow absolute inset-0" />
            <div
              className={`donation-screen-sweep absolute -inset-y-1/3 w-[28vw] min-w-48 ${
                isDonationHovered ? "donation-screen-sweep-active" : ""
              }`}
            />
            <div className="absolute inset-0 ring-1 ring-inset ring-[#ef3030]/10" />
          </div>,
          document.body,
        )}

        {isDonationVideoOpen &&
          createPortal(
            <>
              <video
                ref={donationVideoRef}
                src={donationVideoUrl}
                autoPlay
                muted
                playsInline
                aria-label={title}
                onCanPlay={(event) => {
                  void event.currentTarget.play().catch(() => undefined);
                }}
                onEnded={() => {
                  if (!donationAudioUrl) closeDonationMedia();
                }}
                className="pointer-events-none fixed left-1/2 top-1/2 z-[10000] block h-auto max-h-[72vh] w-[min(720px,calc(100vw-3rem))] -translate-x-1/2 -translate-y-1/2 object-contain"
              />
              {donationAudioUrl && (
                <audio
                  src={donationAudioUrl}
                  autoPlay
                  onCanPlay={(event) => {
                    const video = donationVideoRef.current;
                    if (video) {
                      video.currentTime = 0;
                      void video.play().catch(() => undefined);
                    }
                    event.currentTarget.volume = 1;
                    void event.currentTarget.play().catch(() => undefined);
                  }}
                  onEnded={closeDonationMedia}
                />
              )}
            </>,
            document.body,
          )}

        <aside
          aria-label={title}
          className="relative min-h-[108px] overflow-hidden rounded-xl bg-gradient-to-br from-white via-white to-zinc-100 text-surface-900 shadow-sm ring-1 ring-zinc-200/90 dark:from-surface-100 dark:via-surface-100 dark:to-zinc-900 dark:ring-white/10"
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#ff3535] via-[#e11d2e] to-[#9f0712]" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-white/75 to-transparent dark:from-black/20" />
          <div className="absolute -right-8 top-1/2 h-16 w-56 -translate-y-1/2 rotate-[-12deg] bg-gradient-to-r from-transparent via-zinc-200/40 to-white/70 blur-xl dark:via-white/5 dark:to-white/10" />
          <div aria-hidden="true" className="donation-lamination absolute -inset-y-8 w-20" />
          <IconHeart
            aria-hidden="true"
            size={72}
            stroke={1.15}
            className="absolute right-[7.25rem] top-1/2 -translate-y-1/2 rotate-[-8deg] fill-[#ef3030]/[0.06] text-[#d71920]/25 dark:fill-[#ef3030]/10 dark:text-[#ef3030]/25"
          />

          <div className="relative flex min-h-[108px] items-center justify-between gap-4 py-4 pl-6 pr-5">
            <div className="min-w-0 max-w-sm">
              <h3 className="font-display text-sm font-bold leading-tight text-surface-900">
                {title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-surface-500">
                {description}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDonate}
              onMouseEnter={startDonationHover}
              onMouseLeave={stopDonationHover}
              onFocus={startDonationHover}
              onBlur={stopDonationHover}
              aria-label={action}
              className={`group relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d71920] px-3.5 py-2 text-[10px] font-extrabold text-white shadow-md shadow-[#7f0710]/15 outline-none transition-[background-color,box-shadow] duration-300 hover:bg-[#ef3030] hover:shadow-[0_0_0_4px_rgba(239,48,48,0.12),0_8px_24px_rgba(127,7,16,0.22)] focus-visible:shadow-[0_0_0_4px_rgba(239,48,48,0.18),0_8px_24px_rgba(127,7,16,0.22)] ${
                isDonationHovered ? "donation-button-loading" : ""
              }`}
            >
              <IconHeartHandshake
                aria-hidden="true"
                size={15}
                stroke={1.8}
                className="transition-[transform,filter] duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]"
              />
              {action}
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside
      aria-label={title}
      className="relative min-h-[168px] overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-xl shadow-black/10 ring-1 ring-white/10"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary-400 via-primary-600 to-primary-800" />
      <div className="absolute inset-y-0 right-0 w-2/5 bg-gradient-to-l from-primary-600/30 via-primary-900/15 to-transparent" />
      <div className="absolute -right-14 -top-24 h-64 w-64 rounded-full border-[36px] border-white/[0.025]" />
      <div className="absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-primary-600/20 blur-3xl" />
      <IconHeart
        aria-hidden="true"
        size={150}
        stroke={0.8}
        className="absolute -bottom-10 right-5 rotate-[-10deg] fill-white/[0.025] text-white/[0.07]"
      />

      <div className="relative flex min-h-[168px] flex-col items-start justify-center gap-5 px-7 py-6 sm:flex-row sm:items-center sm:justify-between sm:pl-9 md:px-10 md:pl-11">
        <div className="max-w-2xl">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-primary-400">
            {eyebrow}
          </p>
          <h3 className="font-display text-xl font-bold leading-tight text-white md:text-2xl">
            {title}
          </h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-400 md:text-[13px]">
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDonate}
          className="group z-10 flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-extrabold text-zinc-950 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-primary-400"
        >
          {action}
          <IconArrowUpRight
            size={16}
            className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </aside>
  );
}
