import { Component } from 'preact';
import { html } from 'htm/preact';
import { router } from '../router.js';
import { lockdownsService } from '../services/locksdownsService.js';
import css from 'csz';
const today = new Date();
const mapbox_token = 'pk.eyJ1IjoibWlibG9uIiwiYSI6ImNrMGtvajhwaDBsdHQzbm16cGtkcHZlaXUifQ.dJTOE8FJc801TAT0yUhn3g';
const mapStyles = css`
  & {
    width: 100%;
    height: 100vh;
  }
  canvas {
    background: #f2fcff;
  }
  .hidden {
    display: none;
  }
  .marker {
    color: #fff;
    text-shadow: black 0.1em 0.1em 0.2em;
  }
`;
export class WorldMap extends Component {
  constructor() {
    super();

    this.state = {
      lng: 0,
      lat: 0,
      zoom: 2
    };
  }

  async componentDidMount() {
    // the world map needs a large data source, lazily fetch them in parallel
    const [lockdowns, mapData, capitals] = await Promise.all([
      lockdownsService.getLockdowns(),
      fetch(new URL('../../data/worldmap.geojson', import.meta.url)).then(r => r.json()),
      fetch(new URL('../../data/worldmap_centroids.geojson', import.meta.url)).then(r => r.json())
    ]);

    let markers = [];
    let map = new window.mapboxgl.Map({
      accessToken: mapbox_token,
      container: this.ref,
      center: [this.state.lng, this.state.lat],
      style: 'mapbox://styles/miblon/ck8f3l2fm0s461invs16mrb8n',
      zoom: this.state.zoom
    });

    for (const feature of mapData.features) {
      if (lockdowns[feature.properties.NAME]) {
        feature.properties.data = lockdowns[feature.properties.NAME];
      }
      feature.properties.color = worldStyle(feature);
      //createMarker(feature);
    }

    // map.on('zoom', () => {
    //   checkLabel();
    // });

    map.on('load', function() {
      // checkLabel();
      addLayers();
      let hoveredStateId = null;

      map.on('mousemove', 'countries', function(e) {
        if (e.features.length > 0) {
          if (hoveredStateId) {
            map.setFeatureState(
              {
                source: 'country-polygons',
                id: hoveredStateId
              },
              {
                hover: false
              }
            );
          }

          hoveredStateId = e.features[0].id;

          map.setFeatureState(
            {
              source: 'country-polygons',
              id: hoveredStateId
            },
            {
              hover: true
            }
          );
        }
      });
      map.on('click', 'countries', function(e) {
        router.setSearchParam('country', e.features[0].properties.NAME);
        router.setSearchParam('iso2', e.features[0].properties.iso2);
      });
      map.on('click', 'labels', function(e) {
        console.log(e);
        router.setSearchParam('country', e.features[0].properties.NAME);
        router.setSearchParam('iso2', e.features[0].properties.iso2);
      });
    });

    function addLayers() {
      map.addSource('country-polygons', {
        type: 'geojson',
        data: mapData,
        generateId: true
      });

      map.addLayer({
        id: 'countries',
        type: 'fill',
        source: 'country-polygons',
        layout: {},
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0.4]
        },
        filter: ['has', 'color']
      });

      map.addSource('country-labels', {
        type: 'geojson',
        data: capitals
      });

      map.addLayer({
        id: 'labels',
        type: 'symbol',
        source: 'country-labels',
        layout: {
          'text-field': [
            'format',
            ['get', 'NAME'],
            { 'font-scale': 1 },
            '\n' //,
            // {},
            // ['get', 'iso2'],
            // {
            //   'font-scale': 0.8,
            //   'text-font': ['literal', ['DIN Offc Pro Italic', 'Arial Unicode MS Regular']]
            // }
          ],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.5,
          'text-justify': 'auto'
        }
      });

      //console.log(markers);

      //markers.forEach(marker => {
      //  marker.addTo(map);
      //});
    }
    function createMarker(feature) {
      var centroid = turf.centroid(feature.geometry);
      var el = document.createElement('div');
      el.className = 'marker hidden';
      el.innerHTML = feature.properties.NAME;
      // make a marker for each feature and add to the map
      markers.push(new mapboxgl.Marker(el).setLngLat(centroid.geometry.coordinates));
    }
    function checkLabel() {
      let zoom = map.getZoom();
      console.log(zoom);
      markers.forEach(marker => {
        el = marker.getElement();
        if (zoom < 3) {
          el.classList.add('hidden');
        } else {
          el.classList.remove('hidden');
        }
      });
    }
    function worldStyle(e) {
      // lockdown unknown
      let value = 'orange';

      if (e.properties.data && e.properties.data.lockdowns) {
        if (e.properties.data.lockdowns.length === 0) {
          // no known lockdowns
          value = 'green';
        }

        for (const lockdown of e.properties.data.lockdowns) {
          // TODO: start and end are exclusive or inclusive?
          if (new Date(lockdown.start) >= today && lockdown.end ? new Date(lockdown.end) < today : true) {
            // in lockdown
            value = 'red';
          } else {
            // lockdown expired
            value = 'green';
          }
        }
      }

      return value;
    }

    this.setState({
      map
    });

    if (navigator.permissions) {
      const geolocation = await navigator.permissions.query({ name: 'geolocation' });
      // on pageload, check if there is permission for geolocation
      if (geolocation.state === 'granted') {
        navigator.geolocation.getCurrentPosition(location => {
          const { latitude, longitude } = location.coords;
          this.state.map.setView([latitude, longitude]);
        });
      }

      // handle change when user toggles geolocation permission
      geolocation.addEventListener('change', e => {
        if (e.target.state === 'granted') {
          navigator.geolocation.getCurrentPosition(location => {
            localStorage.setItem('geolocation', 'true');
            const { latitude, longitude } = location.coords;
            this.state.map.setView([latitude, longitude]);
          });
        } else {
          localStorage.removeItem('geolocation');
        }
      });
    }
  }

  componentWillUnmount() {
    this.state.map.remove();
  }

  render() {
    return html`
      <div
        class="map-container ${mapStyles}"
        ref=${ref => {
          this.ref = ref;
        }}
      ></div>
    `;
  }
}
