import React, { useState, useEffect } from 'react';
import { Menu, X, Filter, Search, SortAsc, Grid, List, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Responsive Layout Components for Task Management
 * Mobile-first design with touch-optimized interactions
 */

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Mobile-optimized header with navigation and actions
 */
export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  className
}) => {
  return (
    <header className={cn(
      'sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className
    )}>
      <div className="container flex h-14 items-center px-4">
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mr-2 h-8 w-8 p-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>
        )}
        
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center space-x-2 ml-4">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};

interface MobileFilterSheetProps {
  trigger: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Mobile filter sheet/drawer component
 */
export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  trigger,
  title = "Filters",
  children,
  isOpen,
  onOpenChange
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="left" className="w-full sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  minItemWidth?: number;
  gap?: number;
}

/**
 * Responsive grid that adapts to screen size and content
 */
export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  minItemWidth = 280,
  gap = 16
}) => {
  return (
    <div 
      className={cn('grid w-full', className)}
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${minItemWidth}px, 1fr))`,
        gap: `${gap}px`
      }}
    >
      {children}
    </div>
  );
};

interface MobileTaskCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
}

/**
 * Mobile-optimized task card with touch gestures
 */
export const MobileTaskCard: React.FC<MobileTaskCardProps> = ({
  children,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  className
}) => {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startX) return;
    
    const currentX = e.touches[0].clientX;
    setCurrentX(currentX);
    
    const diffX = Math.abs(currentX - startX);
    if (diffX > 10) {
      setIsSwiping(true);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) {
      onClick?.();
      return;
    }

    const diffX = currentX - startX;
    const threshold = 100;

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (diffX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    setStartX(0);
    setCurrentX(0);
    setIsSwiping(false);
  };

  return (
    <div
      className={cn(
        'touch-manipulation select-none',
        'active:bg-muted/50 transition-colors',
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={!isSwiping ? onClick : undefined}
    >
      {children}
    </div>
  );
};

interface ViewToggleProps {
  currentView: 'list' | 'grid' | 'board';
  onViewChange: (view: 'list' | 'grid' | 'board') => void;
  isMobile?: boolean;
}

/**
 * Responsive view toggle component
 */
export const ViewToggle: React.FC<ViewToggleProps> = ({
  currentView,
  onViewChange,
  isMobile = false
}) => {
  if (isMobile) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {currentView === 'list' && <List className="w-4 h-4" />}
            {currentView === 'grid' && <Grid className="w-4 h-4" />}
            {currentView === 'board' && <MoreVertical className="w-4 h-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onViewChange('list')}>
            <List className="w-4 h-4 mr-2" />
            List View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange('grid')}>
            <Grid className="w-4 h-4 mr-2" />
            Grid View
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewChange('board')}>
            <MoreVertical className="w-4 h-4 mr-2" />
            Board View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex rounded-md border p-1">
      <Button
        variant={currentView === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('list')}
        className="px-3"
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        variant={currentView === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('grid')}
        className="px-3"
      >
        <Grid className="w-4 h-4" />
      </Button>
      <Button
        variant={currentView === 'board' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewChange('board')}
        className="px-3"
      >
        <MoreVertical className="w-4 h-4" />
      </Button>
    </div>
  );
};

interface MobileToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onFilterToggle?: () => void;
  onSortToggle?: () => void;
  viewToggle?: React.ReactNode;
  activeFiltersCount?: number;
  className?: string;
}

/**
 * Mobile toolbar with search, filters, and sort
 */
export const MobileToolbar: React.FC<MobileToolbarProps> = ({
  searchValue = '',
  onSearchChange,
  onFilterToggle,
  onSortToggle,
  viewToggle,
  activeFiltersCount = 0,
  className
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <div className={cn('sticky top-14 z-30 bg-background border-b', className)}>
      {/* Search Bar */}
      {isSearchOpen ? (
        <div className="flex items-center p-4 space-x-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              autoFocus
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSearchOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        /* Toolbar Actions */
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-4 h-4" />
            </Button>
            
            <Button
              variant={activeFiltersCount > 0 ? 'default' : 'ghost'}
              size="sm"
              onClick={onFilterToggle}
              className="relative"
            >
              <Filter className="w-4 h-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSortToggle}
            >
              <SortAsc className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            {viewToggle}
          </div>
        </div>
      )}
    </div>
  );
};

interface BottomSheetProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  maxHeight?: string;
}

/**
 * Bottom sheet component for mobile actions
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  isOpen,
  onClose,
  title,
  maxHeight = '50vh'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-background rounded-t-lg z-50 transform transition-transform duration-200 ease-out"
        style={{ maxHeight }}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 60px)' }}>
          {children}
        </div>
      </div>
    </>
  );
};

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  className?: string;
}

/**
 * Floating action button for primary mobile actions
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon,
  label,
  className
}) => {
  return (
    <Button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40',
        'md:hidden', // Only show on mobile
        className
      )}
      size="lg"
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
    </Button>
  );
};

/**
 * Hook for detecting mobile devices and screen sizes
 */
export function useResponsive() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    screenSize,
    isTouchDevice: 'ontouchstart' in window
  };
}

/**
 * Safe area padding for mobile devices (iPhone notch, etc.)
 */
export const SafeArea: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
  top?: boolean;
  bottom?: boolean;
}> = ({ 
  children, 
  className, 
  top = true, 
  bottom = true 
}) => {
  return (
    <div 
      className={cn(
        top && 'pt-safe-area-inset-top',
        bottom && 'pb-safe-area-inset-bottom',
        className
      )}
      style={{
        paddingTop: top ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : undefined,
      }}
    >
      {children}
    </div>
  );
};