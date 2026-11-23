import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';

export interface UseFileDropZoneOptions {
  disabled?: boolean;
  onDropFiles: (files: File[]) => void;
}

export interface FileDropZoneHandlers {
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

function hasFileTransfer(event: DragEvent<HTMLElement>): boolean {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  return Array.from(types).includes('Files');
}

/**
 * Manages drag-and-drop file state without flickering across nested child elements.
 */
export function useFileDropZone({ disabled = false, onDropFiles }: UseFileDropZoneOptions): {
  isDragging: boolean;
  dropZoneProps: FileDropZoneHandlers;
} {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (disabled) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  }, [disabled]);

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || !hasFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current += 1;
      setIsDragging(true);
    },
    [disabled],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || !hasFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled],
  );

  const onDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (disabled || !hasFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasFileTransfer(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      if (disabled) {
        return;
      }
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        onDropFiles(files);
      }
    },
    [disabled, onDropFiles],
  );

  return {
    isDragging,
    dropZoneProps: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop,
    },
  };
}
