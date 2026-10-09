import { getImageProps } from "next/image";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { AppTopBar } from "@/components/app-top-bar";
import { Badge } from "@/components/ui/badge";
import { cn, dateTime } from "@/lib/utils";
import { publicAssetUrl } from "@/lib/public-asset-url";
import type { EventFlowEvent } from "@/types/eventflow";

/**
 * Artes do hero já em URL pronta para o navegador (a página resolve os campos
 * heroMobileUrl/heroDesktopUrl do evento com publicAssetUrl).
 * Opcionais: sem elas o hero usa o banner (16:5) do evento.
 * - mobileUrl: vertical 9:16, exibida abaixo de 640px.
 * - desktopUrl: horizontal 16:10, exibida a partir de 640px.
 */
export type HeroArt = {
  mobileUrl?: string;
  desktopUrl?: string;
};

type HeroBannerProps = {
  event: EventFlowEvent;
  art?: HeroArt;
};

// O header flutua sobre a arte, sem fundo próprio.
const OVERLAY_TOP_BAR = "absolute inset-x-0 top-0 border-transparent bg-transparent shadow-none backdrop-blur-none";

const INFO_CHIP =
  "glass-card glass-blur flex min-w-0 max-w-full items-start gap-3 rounded-2xl px-4 py-3 font-medium text-foreground/85 sm:inline-flex sm:rounded-full sm:py-2.5 lg:flex lg:w-full lg:rounded-2xl lg:py-3";

/*
 * Composição por tela:
 * - Mobile e tablet têm dois modos:
 *   - "poster": arte dedicada. Sobe por trás do header e desce por trás do título e
 *     dos chips, que ficam sobre a parte em que ela já está se dissolvendo no fundo.
 *     No mobile a arte vira o fundo da seção (absoluta) e o título é posicionado a
 *     ~50% da altura dela (pt em % da largura: 0,5 × 16/9 ≈ 88%), logo depois de
 *     onde a dissolução começa.
 *   - "strip": só o banner em faixa. Começa abaixo do header (para não esconder a
 *     arte) e o título vem logo depois, onde a faixa termina de se dissolver.
 * - Desktop (lg+) é sempre o hero dividido: a capa num card à esquerda (arte desktop
 *   em 16:10 ou, sem ela, o banner em 16:5), título e dados à direita e uma cópia
 *   apagada da capa como fundo. A seção vira `display: contents` e seus itens entram
 *   no grid da página (HERO_SPLIT_PAGE_GRID), junto com o conteúdo do evento: os
 *   ingressos ficam logo abaixo dos dados, na mesma coluna.
 * As classes ficam escritas por extenso para o Tailwind encontrá-las.
 */
const FRAME = {
  mobile: {
    poster: "absolute inset-x-0 top-0 aspect-[9/16] hero-mask-poster",
    strip: "relative mt-16 aspect-[16/10] hero-mask-strip"
  },
  tablet: {
    poster: "sm:relative sm:inset-auto sm:mt-0 sm:aspect-[16/10] sm:max-h-[min(86vh,940px)] sm:hero-mask-poster",
    strip: "sm:relative sm:inset-auto sm:mt-16 sm:aspect-[2/1] sm:hero-mask-strip"
  },
  desktop: {
    poster: "lg:aspect-[16/10]",
    strip: "lg:aspect-[16/5]"
  }
} as const;

const FRAME_DESKTOP =
  "lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mb-0 lg:mt-24 lg:max-h-none lg:self-start lg:rounded-3xl lg:shadow-[0_30px_60px_-40px_rgb(0_0_0/0.6)] lg:ring-1 lg:ring-white/10 lg:[-webkit-mask-image:none] lg:[mask-image:none]";

const CONTENT = {
  mobile: {
    poster: "row-start-1 pt-[88%]",
    strip: "row-start-2 -mt-3"
  },
  tablet: {
    poster: "sm:row-start-1 sm:mt-0 sm:self-end sm:pt-0 sm:pb-12",
    strip: "sm:row-start-2 sm:-mt-6 sm:self-auto sm:pt-0 sm:pb-0"
  }
} as const;

const CONTENT_DESKTOP = "lg:col-start-4 lg:row-start-1 lg:mb-0 lg:mt-24 lg:max-w-none lg:self-start lg:px-0 lg:pb-0";

/**
 * Grid da página no desktop: margem | capa (até 748px) | vão 3rem | dados e
 * ingressos 420px | margem. Linhas: 1 = dados (a capa ocupa 1–2), 2–3 = ingressos,
 * 3 = conteúdo do evento. Aplicado no <main> pela página.
 */
export const HERO_SPLIT_PAGE_GRID =
  "lg:relative lg:grid lg:grid-cols-[minmax(2rem,1fr)_minmax(0,748px)_3rem_420px_minmax(2rem,1fr)] lg:content-start";

// Na arte de tablet com altura limitada, o corte vertical preserva a parte de cima
// (logo). No desktop a capa tem a proporção da própria imagem, sem corte.
const TABLET_POSITION = {
  poster: "sm:object-[center_30%] lg:object-center",
  strip: "sm:object-center"
} as const;

export function HeroBanner({ event, art }: HeroBannerProps) {
  const bannerUrl = publicAssetUrl(event.bannerUrl);
  const mobileArt = art?.mobileUrl;
  const desktopArt = art?.desktopUrl;

  const mobileMode = mobileArt ? "poster" : "strip";
  const desktopMode = desktopArt ? "poster" : "strip";
  const mobileSrc = mobileArt ?? bannerUrl;
  const desktopSrc = desktopArt ?? bannerUrl;

  const location =
    event.format === "ONLINE"
      ? "Evento online"
      : `${event.address ?? event.city ?? "Local não definido"}${event.city ? ` - ${event.city}` : ""}${event.state ? `/${event.state}` : ""}`;

  return (
    <section className="relative grid grid-cols-1 overflow-hidden lg:contents">
      {desktopSrc && <HeroBackdrop src={desktopSrc} />}
      {/* Glass com desfoque progressivo atrás do header: sólido no topo, some para baixo. */}
      <div aria-hidden="true" className="hero-header-veil pointer-events-none absolute inset-x-0 top-0 z-30 h-24" />
      <AppTopBar backHref="/" className={OVERLAY_TOP_BAR} invertedLogo />

      {/* A arte em si: nítida, sem distorção, dissolvendo na cor da plataforma. */}
      <div
        className={cn(
          "col-start-1 row-start-1 w-full overflow-hidden",
          FRAME.mobile[mobileMode],
          FRAME.tablet[desktopMode],
          FRAME.desktop[desktopMode],
          FRAME_DESKTOP
        )}
      >
        {mobileSrc && desktopSrc ? (
          <HeroPicture
            alt={event.title}
            mobileSrc={mobileSrc}
            desktopSrc={desktopSrc}
            className={cn("object-cover object-top", TABLET_POSITION[desktopMode])}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <Ticket className="h-20 w-20 stroke-[1] text-primary/30" />
          </div>
        )}
      </div>

      {/* Título e dados: começam onde a arte já está se dissolvendo. */}
      <div
        className={cn(
          "relative col-start-1 mx-auto w-full max-w-7xl px-4 sm:px-5 lg:px-8",
          CONTENT.mobile[mobileMode],
          CONTENT.tablet[desktopMode],
          CONTENT_DESKTOP
        )}
      >
        <div className="space-y-4 pb-6">
          <h1
            className={cn(
              "animate-slide-up break-words text-[1.75rem] font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] [text-shadow:0_2px_20px_hsl(var(--background)/0.6)] sm:text-4xl lg:text-5xl",
              // Sobre a arte (mobile), o título fica claro em qualquer tema.
              mobileMode === "poster" && "max-sm:text-white max-sm:[text-shadow:0_1px_2px_rgb(0_0_0/0.45),0_2px_18px_rgb(0_0_0/0.55)]"
            )}
          >
            {event.title}
          </h1>

          <div
            className={cn(
              "animate-slide-up flex w-full max-w-full flex-col gap-2.5 text-sm sm:flex-row sm:flex-wrap sm:gap-3 sm:text-[0.9375rem]",
              "lg:flex-col lg:flex-nowrap"
            )}
            style={{ animationDelay: "0.1s" }}
          >
            <span className={INFO_CHIP}>
              <CalendarDays className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{dateTime(event.startsAt)}</span>
            </span>
            <span className={INFO_CHIP}>
              <MapPin className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{location}</span>
            </span>
          </div>

          {event.category && (
            <div className="animate-slide-up lg:hidden" style={{ animationDelay: "0.15s" }}>
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                {event.category}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Fundo do hero (só desktop): uma cópia da arte cobrindo as linhas do hero
 * no grid da página (até o fim da capa), apagada e
 * dissolvendo para a cor da plataforma. Usa os mesmos srcSet/sizes da arte
 * principal (o navegador reaproveita o arquivo) e, abaixo de 1024px, a <source>
 * aponta para um GIF vazio inline para nem pedir a arte desktop.
 */
function HeroBackdrop({ src }: { src: string }) {
  const { props } = getImageProps({ src, alt: "", fill: true, sizes: "100vw" });

  return (
    <div
      aria-hidden="true"
      className="hero-mask-backdrop pointer-events-none absolute inset-0 hidden overflow-hidden lg:col-[1/-1] lg:row-[1/3] lg:block"
    >
      <picture>
        <source media="(max-width: 1023px)" srcSet={EMPTY_IMAGE} />
        <img {...props} alt="" className="scale-105 object-cover object-[center_35%] opacity-25 blur-[6px] dark:opacity-35" />
      </picture>
    </div>
  );
}

/**
 * Uma única <img> com direção de arte: o navegador baixa só a versão do breakpoint
 * atual (mobile abaixo de 640px, desktop a partir disso).
 */
function HeroPicture({
  alt,
  mobileSrc,
  desktopSrc,
  className
}: {
  alt: string;
  mobileSrc: string;
  desktopSrc: string;
  className: string;
}) {
  const common = { alt, fill: true, priority: true, sizes: "100vw" } as const;
  const { props: desktopProps } = getImageProps({ ...common, src: desktopSrc });
  const mobileSrcSet = mobileSrc === desktopSrc ? undefined : getImageProps({ ...common, src: mobileSrc }).props.srcSet;

  return (
    <picture>
      {mobileSrcSet && <source media="(max-width: 639px)" srcSet={mobileSrcSet} sizes="100vw" />}
      {/* next/image não faz direção de arte; os props vêm de getImageProps. */}
      <img {...desktopProps} alt={alt} className={className} />
    </picture>
  );
}
