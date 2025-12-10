import React from 'react';
import { LightbulbIcon } from './LightbulbIcon.tsx';
import { CalculatorIcon, ChartIcon, ListIcon } from './ToolIcons.tsx';

const iconMap: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
  calculator: CalculatorIcon,
  chart: ChartIcon,
  list: ListIcon,
  idea: LightbulbIcon,
};

export const DynamicIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const sanitizedName = name ? name.toLowerCase() : 'idea';
    const IconComponent = iconMap[sanitizedName] || LightbulbIcon;
    return <IconComponent className={className} />;
};