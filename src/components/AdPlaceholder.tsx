import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AdPlaceholderProps {
  /** Ad slot identifier (e.g., 'banner', 'sidebar', 'inline') */
  slot?: string;
  /** Ad size/format (e.g., 'banner', 'rectangle', 'square') */
  format?: 'banner' | 'rectangle' | 'square' | 'sidebar';
  /** Custom className */
  className?: string;
  /** Show label (default: true) */
  showLabel?: boolean;
}

/**
 * Ad placeholder component for layout slots
 * Replace this component with actual ad network integration when ready
 */
export function AdPlaceholder({ 
  slot = 'ad', 
  format = 'banner',
  className,
  showLabel = true 
}: AdPlaceholderProps) {
  const sizeClasses = {
    banner: 'w-full h-24 md:h-32',
    rectangle: 'w-full h-60 md:h-80',
    square: 'w-full aspect-square max-w-sm mx-auto',
    sidebar: 'w-full h-96',
  };

  return (
    <Card 
      className={cn(
        'flex items-center justify-center bg-muted/30 border-dashed',
        sizeClasses[format],
        className
      )}
      data-ad-slot={slot}
      data-ad-format={format}
    >
      {showLabel && (
        <div className="text-center text-muted-foreground text-sm">
          <div className="font-medium">Ad Placeholder</div>
          <div className="text-xs mt-1 opacity-60">{slot}</div>
        </div>
      )}
    </Card>
  );
}

