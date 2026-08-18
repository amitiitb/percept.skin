import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Percept | personalised AI skin analysis and practical improvement plans";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const background = await readFile(
    join(process.cwd(), "public/brand/og-image.png"),
  );
  const backgroundSrc = `data:image/png;base64,${background.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#253236",
          color: "#f5f8f8",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={backgroundSrc}
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(24,40,45,0.99) 0%, rgba(24,40,45,0.93) 35%, rgba(24,40,45,0.15) 72%, rgba(24,40,45,0.04) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 710,
            padding: "68px 0 64px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                width: 52,
                height: 52,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 26,
                background: "#f5f8f8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 32,
                  height: 32,
                  border: "5px solid #253236",
                  borderRightColor: "#afc0c7",
                  borderRadius: 20,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 9,
                  top: 24,
                  display: "flex",
                  width: 16,
                  height: 5,
                  borderRadius: 5,
                  background: "#71878f",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 42,
                fontWeight: 600,
                letterSpacing: "-1.8px",
              }}
            >
              percept
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                maxWidth: 610,
                fontSize: 68,
                fontWeight: 500,
                lineHeight: 1.02,
                letterSpacing: "-3.4px",
              }}
            >
              See your skin more clearly.
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 540,
                color: "#d1ebf2",
                fontSize: 25,
                lineHeight: 1.35,
                letterSpacing: "-0.3px",
              }}
            >
              Six photos. Twenty-one signals. One practical plan.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "rgba(245,248,248,0.72)",
              fontSize: 17,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                display: "flex",
                width: 34,
                height: 1,
                background: "#afc0c7",
              }}
            />
            Capture · Analyse · Improve
          </div>
        </div>
      </div>
    ),
    size,
  );
}
