export interface TooltipProps {
  title: string;
  'aria-label'?: string;
  'data-tooltip'?: string;
}

export function tooltipProps(title: string): TooltipProps {
  return {
    title,
    'aria-label': title,
    'data-tooltip': title,
  };
}
