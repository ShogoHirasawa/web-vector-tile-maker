import { useEffect, useRef } from 'react';
import { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapPreviewProps {
  center: [number, number];
  zoom: number;
  layerName: string;
  minZoom: number;
  maxZoom: number;
}

export function MapPreview({ center, zoom, layerName, minZoom, maxZoom }: MapPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('[MapPreview] Initializing map...', { center, zoom, layerName });

    // MapLibreインスタンス作成
    map.current = new MapLibreMap({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
          'vector-tiles': {
            type: 'vector',
            tiles: ['mem://tiles/{z}/{x}/{y}.pbf'],
            minzoom: minZoom,
            maxzoom: maxZoom,
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: `${layerName}-points`,
            type: 'circle',
            source: 'vector-tiles',
            'source-layer': layerName,
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
              'circle-radius': 6,
              'circle-color': '#ff3333',
              'circle-opacity': 0.8,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          },
          {
            id: `${layerName}-lines`,
            type: 'line',
            source: 'vector-tiles',
            'source-layer': layerName,
            filter: ['==', ['geometry-type'], 'LineString'],
            paint: {
              'line-color': '#3388ff',
              'line-width': 3,
              'line-opacity': 0.8,
            },
          },
          {
            id: `${layerName}-polygons`,
            type: 'fill',
            source: 'vector-tiles',
            'source-layer': layerName,
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'fill-color': '#ffaa00',
              'fill-opacity': 0.5,
            },
          },
          {
            id: `${layerName}-polygons-outline`,
            type: 'line',
            source: 'vector-tiles',
            'source-layer': layerName,
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: {
              'line-color': '#ff8800',
              'line-width': 2,
            },
          },
        ],
      },
      center: center,
      zoom: zoom,
    });

    // マップロード完了イベント
    map.current.on('load', () => {
      console.log('[MapPreview] Map loaded successfully');
    });

    // エラーハンドリング
    map.current.on('error', (e) => {
      console.error('[MapPreview] Map error:', e);
    });

    // クリーンアップ
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        console.log('[MapPreview] Map removed');
      }
    };
  }, [center, zoom, layerName, minZoom, maxZoom]);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: '500px',
        borderRadius: '8px',
        overflow: 'hidden',
      }} 
    />
  );
}
