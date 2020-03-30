import { Component } from 'preact';
import { html } from 'htm/preact';
import { router } from '../router.js';
import { lockdownsService } from '../services/locksdownsService.js';
import css from 'csz';

const mapbox_token = 'pk.eyJ1IjoibWlibG9uIiwiYSI6ImNrMGtvajhwaDBsdHQzbm16cGtkcHZlaXUifQ.dJTOE8FJc801TAT0yUhn3g';
const today = new Date();

const mapStyles = css`
  canvas {
    background: #f2fcff;
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
    const lockdowns = await lockdownsService.getLockdowns();
    const mapData = await (await fetch(new URL('../../data/worldmap.json', import.meta.url))).json();
    let markers = [];
    let map = new window.mapboxgl.Map({
      //accessToken: mapbox_token,
      container: this.ref,
      //style: 'mapbox://styles/mapbox/light-v10',
      center: [this.state.lng, this.state.lat],
      zoom: this.state.zoom
    });

    for (const feature of mapData.features) {
      if (lockdowns[feature.properties.NAME]) {
        feature.properties.data = lockdowns[feature.properties.NAME];
      }
      feature.properties.color = worldStyle(feature);
      // create a HTML element for each feature
      //var polygon = turf.multiPolygon(f.geometry.coordinates);
      //console.log(polygon);
      var centroid = turf.centroid(feature.geometry);
      var el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = feature.properties.NAME;
      // make a marker for each feature and add to the map
      markers.push(new mapboxgl.Marker(el).setLngLat(centroid.geometry.coordinates));
    }

    map.addSource('countries', {
      type: 'geojson',
      data: mapData,
      generateId: true
    });

    map.addLayer({
      id: 'countries',
      type: 'fill',
      source: 'countries',
      layout: {},
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 0.4]
      },
      filter: ['has', 'color']
    });
    console.log(markers);

    markers.forEach(marker => {
      marker.addTo(map);
    });

    map.on('load', function() {
      let hoveredStateId = null;

      map.on('mousemove', 'countries', function(e) {
        if (e.features.length > 0) {
          if (hoveredStateId) {
            map.setFeatureState(
              {
                source: 'countries',
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
              source: 'countries',
              id: hoveredStateId
            },
            {
              hover: true
            }
          );
        }
      });
      map.on('click', 'countries', function(e) {
        // map.fitBounds(layer.getBounds());
        router.setSearchParam('country', e.features[0].properties.NAME);
      });
    });

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
