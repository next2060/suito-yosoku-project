import { useEffect } from 'react';
import L from 'leaflet';

const BaseLayerSwitcher = ({ map }) => {
  useEffect(() => {
    if (!map) return;

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19,
    });

    const baseLayers = {
      "OpenStreetMap": osmLayer,
      "衛星写真": satelliteLayer
    };

    // Add default layer to the map
    osmLayer.addTo(map);

    // Add layer control to the map
    const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    // Cleanup function to run when component unmounts
    return () => {
      map.removeControl(layerControl);
      // Remove layers to avoid duplication if the component were to re-render
      if (map.hasLayer(osmLayer)) {
        map.removeLayer(osmLayer);
      }
      if (map.hasLayer(satelliteLayer)) {
        map.removeLayer(satelliteLayer);
      }
    };
  }, [map]);

  return null; // This is a controller component, it doesn't render anything itself
};

export default BaseLayerSwitcher;
