import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: string;
  fallback?: string;
  priority?: boolean;
  fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

export function OptimizedImage({
  src,
  alt,
  className,
  aspectRatio = "16/9",
  fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f0f0f0' width='400' height='300'/%3E%3C/svg%3E",
  priority = false,
  fit = "cover",
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset states quando src mudar
    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      setImgSrc(fallback);
    };

    // Carregar imagem
    if (priority) {
      img.src = src;
    } else {
      // Lazy load - usar IntersectionObserver seria melhor mas isso é mais simples
      const timeout = setTimeout(() => {
        img.src = src;
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [src, fallback, priority]);

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ aspectRatio }}
    >
      <img
        {...props}
        src={imgSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "w-full h-full transition-opacity duration-300",
          fit === "cover" && "object-cover",
          fit === "contain" && "object-contain",
          fit === "fill" && "object-fill",
          fit === "none" && "object-none",
          fit === "scale-down" && "object-scale-down",
          isLoading ? "opacity-0" : "opacity-100",
          hasError && "opacity-50"
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs">
          <span>Erro ao carregar</span>
        </div>
      )}
    </div>
  );
}
