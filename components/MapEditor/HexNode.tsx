import React, { memo } from 'react';
import { HexData } from '@/types';
import { TERRAIN_TYPES } from '@/lib/constants';
import { getHexPointsStr } from '@/lib/utils/hex';

export interface HexNodeProps {
    hex: HexData;
    size: number;
    isHovered: boolean;
    onHover: (key: string | null) => void;
    onClick: (hex: HexData) => void;
    renderPass?: 'all' | 'base' | 'decoration';
}

const HexNode: React.FC<HexNodeProps> = ({ hex, size, isHovered, onHover, onClick, renderPass = 'all' }) => {
    const terrain = hex.terrainId ? TERRAIN_TYPES[hex.terrainId] : null;
    const hexWidth = size * Math.sqrt(3);
    const assetScale = terrain?.scale || 1.15;
    const assetWidth = hexWidth * assetScale;
    const assetVOffset = (terrain?.vOffset || 0) * size * 3;

    return (
        <g className="transition-all duration-300">
            {(renderPass === 'all' || renderPass === 'base') && (
                <polygon
                    points={getHexPointsStr(hex.x, hex.y, size * 1.01)}
                    fill={hex.color}
                    stroke={isHovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.02)"}
                    strokeWidth="1.5"
                    className="cursor-pointer"
                    onMouseEnter={() => onHover(hex.key || null)}
                    onMouseLeave={() => onHover(null)}
                    onClick={() => onClick(hex)}
                />
            )}
            {(renderPass === 'all' || renderPass === 'decoration') && terrain?.url && (
                <image
                    href={terrain.url}
                    x={hex.x - assetWidth / 2}
                    y={hex.y + (size * 0.8) - assetWidth - assetVOffset}
                    width={assetWidth}
                    height={assetWidth}
                    preserveAspectRatio="xMidYMax meet"
                    pointerEvents="none"
                    style={{
                        filter: isHovered ? 'brightness(1.2) drop-shadow(0 10px 25px rgba(0,0,0,0.8))' : 'none',
                        transform: isHovered ? 'scale(1.02)' : 'none',
                        transformOrigin: `${hex.x}px ${hex.y}px`,
                        transition: 'all 0.3s ease-out'
                    }}
                />
            )}
        </g>
    );
};

export default memo(HexNode);
