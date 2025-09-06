import React, { useState, useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { LoadingSpinner } from './loading-states';
import { cn } from '@/lib/utils';

/**
 * Page Transition Components
 * Smooth animations for route transitions and page loading states
 */

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  type?: 'slide' | 'fade' | 'scale' | 'none';
}

// Animation variants for different transition types
const slideVariants: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

const scaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.05 }
};

/**
 * Main page transition wrapper
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className,
  duration = 0.3,
  type = 'fade'
}) => {
  const location = useLocation();
  const navigationType = useNavigationType();

  const getVariants = () => {
    switch (type) {
      case 'slide': return slideVariants;
      case 'scale': return scaleVariants;
      case 'fade': return fadeVariants;
      case 'none': return {};
      default: return fadeVariants;
    }
  };

  if (type === 'none') {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={getVariants()}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration, ease: 'easeInOut' }}
        className={cn('w-full', className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Task-specific page transition for task management routes
 */
interface TaskPageTransitionProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
}

export const TaskPageTransition: React.FC<TaskPageTransitionProps> = ({
  children,
  isLoading = false,
  loadingMessage = 'Loading...'
}) => {
  const location = useLocation();
  const isTaskRoute = location.pathname.includes('/task');

  return (
    <PageTransition type={isTaskRoute ? 'slide' : 'fade'} duration={0.2}>
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center min-h-[200px]"
          >
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-muted-foreground">{loadingMessage}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

/**
 * Staggered animation for list items
 */
interface StaggeredListProps {
  children: React.ReactNode[];
  delay?: number;
  className?: string;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  delay = 0.1,
  className
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: delay
          }
        }
      }}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

/**
 * Loading overlay with smooth transitions
 */
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  blur = true
}) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            'absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
            !blur && 'backdrop-blur-none'
          )}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">{message}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Slide-in panel animation for modals/sidebars
 */
interface SlideInPanelProps {
  children: React.ReactNode;
  isOpen: boolean;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export const SlideInPanel: React.FC<SlideInPanelProps> = ({
  children,
  isOpen,
  direction = 'right',
  className
}) => {
  const getInitialPosition = () => {
    switch (direction) {
      case 'left': return { x: '-100%' };
      case 'right': return { x: '100%' };
      case 'top': return { y: '-100%' };
      case 'bottom': return { y: '100%' };
      default: return { x: '100%' };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ ...getInitialPosition(), opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ ...getInitialPosition(), opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Card hover animations
 */
export const AnimatedCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hoverScale?: number;
  clickScale?: number;
  onClick?: () => void;
}> = ({
  children,
  className,
  hoverScale = 1.02,
  clickScale = 0.98,
  onClick
}) => {
  return (
    <motion.div
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: clickScale }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </motion.div>
  );
};

/**
 * Route-based loading indicator
 */
export const RouteLoadingIndicator: React.FC = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  useEffect(() => {
    setIsLoading(true);
    
    // Set route-specific loading messages
    if (location.pathname.includes('/tasks/create')) {
      setLoadingMessage('Loading task creation form...');
    } else if (location.pathname.includes('/tasks/')) {
      setLoadingMessage('Loading task details...');
    } else if (location.pathname.includes('/manager/tasks')) {
      setLoadingMessage('Loading manager dashboard...');
    } else if (location.pathname.includes('/employee/tasks')) {
      setLoadingMessage('Loading your tasks...');
    } else {
      setLoadingMessage('Loading...');
    }

    // Simulate loading time (in real app, this would be handled by route components)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 h-1 bg-primary/20 z-50"
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full bg-primary"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Button with loading animation
 */
interface AnimatedButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  isLoading = false,
  loadingText = 'Loading...',
  disabled = false,
  onClick,
  className,
  variant = 'default'
}) => {
  return (
    <motion.button
      whileHover={!disabled && !isLoading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isLoading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'relative overflow-hidden transition-colors',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2"
          >
            <LoadingSpinner size="sm" />
            {loadingText}
          </motion.span>
        ) : (
          <motion.span
            key="content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};