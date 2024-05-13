class TripCounts {
    constructor(counts_data) {
        this.total = 0;
        this.by_ride_type = {
            classic_bike: 0,
            electric_bike: 0
        };
        this.by_member_type = {
            casual: 0,
            member: 0
        };
        this.by_ride_type_and_member_type = {
            classic_bike: {
                casual: 0,
                member: 0
            },
            electric_bike: {
                casual: 0,
                member: 0
            }
        }

        if (counts_data) {
            this.add(counts_data);
        }
    }

    add(counts_data) {
        this.total += counts_data.total
        this.by_ride_type.classic_bike += counts_data.by_ride_type.classic_bike;
        this.by_ride_type.electric_bike += counts_data.by_ride_type.electric_bike;
        this.by_member_type.casual += counts_data.by_member_type.casual;
        this.by_member_type.member += counts_data.by_member_type.member;
        this.by_ride_type_and_member_type.classic_bike.casual += counts_data.by_ride_type_and_member_type.classic_bike.casual;
        this.by_ride_type_and_member_type.classic_bike.member += counts_data.by_ride_type_and_member_type.classic_bike.member;
        this.by_ride_type_and_member_type.electric_bike.casual += counts_data.by_ride_type_and_member_type.electric_bike.casual;
        this.by_ride_type_and_member_type.electric_bike.member += counts_data.by_ride_type_and_member_type.electric_bike.member;
    }
}

class Trips {
    constructor(stations_by_id, trip_data) {
        this.start_station = stations_by_id.get(trip_data.start_station_id);
        this.end_station = stations_by_id.get(trip_data.end_station_id);

        this.distance = this.start_station.point.distanceTo(this.end_station.point) / 1000; // Distance in kilometers.

        this.trip_counts = new TripCounts(trip_data.trip_counts);

        this.is_round_trip = this.start_station.id === this.end_station.id;

        this.start_station.add_starting_trips(this);
        this.end_station.add_ending_trips(this);
    }

    display(map_layer) {
        if (this.is_round_trip) { return; }

        let lineColor = "#CE0099";
        let lineWeight = Math.max(2, 2*Math.pow(this.trip_counts.total, 1/Math.E)); // Scale line weight as cube of trips.
        let lineOpacity = 0.6;

        let polyline = L.polyline([this.start_station.point, this.end_station.point], {
            color: lineColor,
            opacity: lineOpacity,
            weight: lineWeight
        });

        // Adding arrows to the polyline
        let decorator = L.polylineDecorator(polyline, {
            patterns: [{
                offset: '100%',
                repeat: 1,
                symbol: L.Symbol.arrowHead({
                    pixelSize: 8,
                    polygon: false,
                    pathOptions: {
                        stroke: true,
                        color: '#CE0099', // Example: Red color for the arrowhead
                        opacity: lineOpacity,
                        weight: lineWeight
                    }
                })
            }]
        });

        // Display aggregate ride count data on hover.
        let popupContent = tag.div(
            tag.h4(`${this.start_station.name} -> ${this.end_station.name}`),
            tag.strong('Total Trips'), ` ${this.trip_counts.total}`, tag.br(),
            tag.strong('Total Trips'), ` ${this.distance.toFixed(2)} km`, tag.br(),
            tag.ul(
                tag.li(`Classic Bike trips: ${this.trip_counts.by_ride_type.classic_bike}`),
                tag.li(`Electric Bike trips: ${this.trip_counts.by_ride_type.electric_bike}`),
                tag.li(`Member trips: ${this.trip_counts.by_member_type.member}`),
                tag.li(`Non-member trips: ${this.trip_counts.by_member_type.casual}`),
                tag.li(`Member trips on Classic Bike: ${this.trip_counts.by_ride_type_and_member_type.classic_bike.member}`),
                tag.li(`Member trips on Electric Bike: ${this.trip_counts.by_ride_type_and_member_type.electric_bike.member}`),
                tag.li(`Non-member trips on Classic Bike: ${this.trip_counts.by_ride_type_and_member_type.classic_bike.casual}`),
                tag.li(`Non-member trips on Electirc Bike: ${this.trip_counts.by_ride_type_and_member_type.electric_bike.casual}`),
            ),
        );

        polyline.bindPopup(popupContent);

        polyline.on('click', function(e) {
            e.target.openPopup();
        });

        map_layer.addLayer(polyline);
        map_layer.addLayer(decorator);
    }
}

// Define a custom marker icon
var customMarker = L.icon({
    iconUrl: 'img/custom-marker.png',
    iconSize: [21, 26],  // Size of the icon
    iconAnchor: [10, 26],  // Point of the icon which will correspond to marker's location
    popupAnchor: [1, -14]  // Point from which the popup should open relative to the iconAnchor
});

class Station {
    static DISPLAY_MODE_NONE = "NONE"
    static DISPLAY_MODE_STARTING = "STARTING"
    static DISPLAY_MODE_ENDING = "ENDING"

    constructor(id, name, lat, lng, markers_layer, station_trips_layer) {
        this.id = id;
        this.name = name;
        this.lat = parseFloat(lat);
        this.lng = parseFloat(lng);
        this.point = new L.LatLng(this.lat, this.lng);

        this.display_mode = Station.DISPLAY_MODE_NONE;
        this.trips_layer = station_trips_layer;

        this.trips_starting_here = [];
        this.trips_ending_here = [];
        this.max_starting_trip_count = 0;
        this.max_ending_trip_count = 0;
        this.round_trip_count = 0;

        this.trip_display_min_count = 0;

        this.combined_starting_trip_counts = new TripCounts();
        this.combined_ending_trip_counts = new TripCounts();

        this.marker = L.marker([this.lat, this.lng], {icon: customMarker});
        this.marker.bindPopup(() => this.createPopupContent());

        // Bind events for hover popup and click.
        this.marker.on('mouseover', () => this.marker.openPopup() );

        markers_layer.addLayer(this.marker);
    }

    add_starting_trips(trips) {
        this.trips_starting_here.push(trips);
        this.combined_starting_trip_counts.add(trips.trip_counts);
        if (!trips.is_round_trip && trips.trip_counts.total > this.max_starting_trip_count) {
            this.max_starting_trip_count = trips.trip_counts.total;
        }
    }

    add_ending_trips(trips) {
        this.trips_ending_here.push(trips);
        this.combined_ending_trip_counts.add(trips.trip_counts);
        if (trips.is_round_trip) {
            this.round_trip_count += trips.trip_counts.total;
        } else if (trips.trip_counts.total > this.max_ending_trip_count) {
            this.max_ending_trip_count = trips.trip_counts.total;
        }
    }

    createPopupContent() {
        return tag.div(
            tag.h3(this.name),
            tag.strong('Trips starting here'), `: ${this.combined_starting_trip_counts.total}`, tag.br(),
            tag.strong('Trips ending here'), `: ${this.combined_ending_trip_counts.total}`, tag.br(),
            tag.strong('Round trips'), `: ${this.round_trip_count}`, tag.br(),
            this.createTripDisplayForm(),
        );
    }

    createTripDisplayForm() {
        let minCountInput = tag.input({attrs: {
            type: 'number',
            id: `${this.id}_trip-display-filter-min-count`,
            name: 'filter-min-count',
            value: this.trip_display_min_count,
            min: 1, max: this.maxTripsForCurrentDisplayMode(),
        }});
        let displayNoneInput = tag.input({attrs: {
            type: 'radio',
            id: `${this.id}_trip-display-choice-none`,
            name: 'mode', value: 'none',
        }});
        let displayStartingInput = tag.input({attrs: {
            type: 'radio', id: `${this.id}_trip-display-choice-starting`,
            name: 'mode', value: 'starting'
        }});
        let displayEndingInput = tag.input({attrs: {
            type: 'radio', id: `${this.id}_trip-display-choice-ending`,
            name: 'mode', value: 'ending-here'
        }});

        // Make sure one of the radio inputs is checked.
        let checkedRadio = displayNoneInput;
        switch (this.display_mode) {
        case Station.DISPLAY_MODE_STARTING:
            checkedRadio = displayStartingInput;
            break;
        case Station.DISPLAY_MODE_ENDING:
            checkedRadio = displayEndingInput;
            break;
        default:
            minCountInput.setAttribute('disabled', '');
        }
        checkedRadio.setAttribute('checked', '');

        for (let [radioInput, mode] of [
            [displayNoneInput, Station.DISPLAY_MODE_NONE],
            [displayStartingInput, Station.DISPLAY_MODE_STARTING],
            [displayEndingInput, Station.DISPLAY_MODE_ENDING],
        ]) {
            radioInput.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.display_mode = mode;
                    let maxTrips = this.maxTripsForCurrentDisplayMode();
                    if (maxTrips === 0) {
                        minCountInput.setAttribute('disabled', '');
                    } else {
                        minCountInput.removeAttribute('disabled');
                        minCountInput.setAttribute('max', maxTrips);
                    }
                    this.toggleDisplayTrips();
                }
            });
        }

        minCountInput.addEventListener('change', (e) => {
            this.trip_display_min_count = e.target.value;
            this.toggleDisplayTrips();
        });

        return tag.form(
            tag.fieldset(
                tag.legend(tag.strong('Trip Display')),
                tag.div(
                    displayNoneInput,
                    tag.label({attrs: {for: `${this.id}_trip-display-choice-none`}}, 'None'),
                    displayStartingInput,
                    tag.label({attrs: {for: `${this.id}_trip-display-choice-starting`}}, 'Starting Here'),
                    displayEndingInput,
                    tag.label({attrs: {for: `${this.id}_trip-display-choice-ending`}}, 'Ending Here'),
                    tag.hr(),
                    tag.em('Only show routes with at least '),
                    minCountInput,
                    tag.em(' trips.'),
                ),
            )
        );
    }

    toggleDisplayTrips() {
        // Clear any existing trips displayed.
        this.trips_layer.clearLayers();

        switch (this.display_mode) {
        case Station.DISPLAY_MODE_STARTING:
            return this.display_trips_out();
        case Station.DISPLAY_MODE_ENDING:
            return this.display_trips_in();
        }
    }

    maxTripsForCurrentDisplayMode() {
        switch (this.display_mode) {
        case Station.DISPLAY_MODE_STARTING:
            return this.max_starting_trip_count;
        case Station.DISPLAY_MODE_ENDING:
            return this.max_ending_trip_count;
        default:
            return 0;
        }
    }

    display_trips_out() {
        this.display_trips(this.trips_starting_here);
    }

    display_trips_in() {
        this.display_trips(this.trips_ending_here);
    }

    display_trips(trips) {
        trips.forEach(trip => {
            if (trip.trip_counts.total >= this.trip_display_min_count) {
                trip.display(this.trips_layer);
            }
        });
    }

}

document.addEventListener('DOMContentLoaded', function() {
    let map = L.map('map').setView([37.82, -122.27], 14); // Coordinates for Oakland

    // Add CartoDB Positron tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    let markers_layer = new L.LayerGroup().addTo(map);

    // Fetch the JSON data for stations
    fetch('data/prepared/202404-baywheels-tripdata.json')
    .then(response => response.json())
    .then(data => {
        let stations = new Map();

        data.stations.forEach(function(stn) {
            let station = new Station(stn.id, stn.name, stn.lat, stn.lng, markers_layer, new L.LayerGroup().addTo(map));
            stations.set(station.id, station);
        });

        let longest_trip = null;
        data.aggregated_trips.forEach(function(trip_data) {
            let trip = new Trips(stations, trip_data);
            if (!longest_trip || trip.distance > longest_trip.distance) {
                longest_trip = trip;
            }
        });
    });
});
