import { useEffect, useRef } from "react";

const HEX_CHARS = "0123456789abcdef";

export function HexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const columns: { chars: string[]; y: number; speed: number; opacity: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns.length = 0;
      const colWidth = 28;
      const numCols = Math.floor(canvas.width / colWidth);
      for (let i = 0; i < numCols; i++) {
        if (Math.random() > 0.3) continue; // sparse
        columns.push({
          chars: Array.from({ length: 8 }, () => HEX_CHARS[Math.floor(Math.random() * 16)]),
          y: Math.random() * canvas.height,
          speed: 0.3 + Math.random() * 0.7,
          opacity: 0.03 + Math.random() * 0.07,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "13px 'IBM Plex Mono', monospace";

      const colWidth = 28;
      let colIdx = 0;
      const numCols = Math.floor(canvas.width / colWidth);

      for (let i = 0; i < numCols; i++) {
        if (colIdx >= columns.length) break;
        const col = columns[colIdx];
        if (!col) continue;

        col.y += col.speed;
        if (col.y > canvas.height + 200) col.y = -200;

        col.chars.forEach((char, j) => {
          ctx.fillStyle = `rgba(200, 240, 77, ${col.opacity})`;
          ctx.fillText(char, i * colWidth, col.y + j * 18);
        });

        // Randomly change a char
        if (Math.random() > 0.98) {
          const idx = Math.floor(Math.random() * col.chars.length);
          col.chars[idx] = HEX_CHARS[Math.floor(Math.random() * 16)];
        }
        colIdx++;
      }

      animId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
