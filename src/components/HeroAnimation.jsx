import { useEffect, useRef, useState } from 'react';

/**
 * HeroAnimation — Canvas-based frame-by-frame animation
 * Preloads all frames, crops watermark, plays at 24fps.
 */
const TOTAL_FRAMES = 105;
const FPS = 24;
const CROP_BOTTOM_PERCENT = 0.06; // Crop bottom 6% to remove watermark

export default function HeroAnimation({ className = '' }) {
    const canvasRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    );
    const imagesRef = useRef([]);
    const frameRef = useRef(0);
    const lastTimeRef = useRef(0);
    const animIdRef = useRef(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(max-width: 767px)');
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener?.('change', handler);
        return () => mq.removeEventListener?.('change', handler);
    }, []);

    useEffect(() => {
        // Skip the 105-frame preload on mobile — saves ~1.8MB and 100+ requests
        if (isMobile) return;
        let cancelled = false;
        const images = [];
        let loadedCount = 0;

        for (let i = 1; i <= TOTAL_FRAMES; i++) {
            const img = new Image();
            const num = String(i).padStart(3, '0');
            img.src = `/hero-frames/ezgif-frame-${num}.jpg`;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === TOTAL_FRAMES && !cancelled) {
                    imagesRef.current = images;
                    setLoaded(true);
                }
            };
            img.onerror = () => { loadedCount++; };
            images.push(img);
        }

        return () => { cancelled = true; };
    }, [isMobile]);

    useEffect(() => {
        if (!loaded || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const interval = 1000 / FPS;

        const firstImg = imagesRef.current[0];
        if (!firstImg) return;

        const srcW = firstImg.naturalWidth;
        const srcH = firstImg.naturalHeight;
        const cropH = Math.floor(srcH * (1 - CROP_BOTTOM_PERCENT));

        canvas.width = srcW;
        canvas.height = cropH;

        const animate = (timestamp) => {
            animIdRef.current = requestAnimationFrame(animate);
            const delta = timestamp - lastTimeRef.current;

            if (delta >= interval) {
                lastTimeRef.current = timestamp - (delta % interval);
                const frame = frameRef.current % TOTAL_FRAMES;
                const img = imagesRef.current[frame];

                if (img && img.complete) {
                    ctx.clearRect(0, 0, srcW, cropH);
                    ctx.drawImage(img, 0, 0, srcW, cropH, 0, 0, srcW, cropH);
                }

                frameRef.current++;
            }
        };

        animIdRef.current = requestAnimationFrame(animate);

        return () => {
            if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
        };
    }, [loaded]);

    // Mobile: render a single static poster image (no preload, no canvas)
    if (isMobile) {
        return (
            <div className={`relative ${className}`}>
                <img
                    src="/hero-frames/ezgif-frame-001.jpg"
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover"
                />
            </div>
        );
    }

    return (
        <div className={`relative ${className}`}>
            {!loaded && (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
            )}
            <canvas
                ref={canvasRef}
                className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                style={{ display: 'block' }}
            />
        </div>
    );
}
