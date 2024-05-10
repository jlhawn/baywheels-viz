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
        this.trip_counts = new TripCounts(trip_data.trip_counts);

        this.is_round_trip = this.start_station.id === this.end_station.id;

        this.start_station.add_starting_trips(this);
        this.end_station.add_ending_trips(this);
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
    constructor(id, name, lat, lng, map) {
        this.id = id;
        this.name = name;
        this.lat = parseFloat(lat);
        this.lng = parseFloat(lng);

        this.map = map;

        this.lines = [];
        this.decorators = [];

        this.trips_starting_here = [];
        this.trips_ending_here = [];
        this.round_trip_count = 0;

        this.combined_starting_trip_counts = new TripCounts();
        this.combined_ending_trip_counts = new TripCounts();

        this.marker = L.marker([this.lat, this.lng], {icon: customMarker});
        this.marker.bindPopup(() => this.createPopupContent());

        // Bind events for hover popup and click.
        this.marker.on('mouseover', () => this.marker.openPopup() );
        this.marker.on('mouseout', () => this.marker.closePopup() );
        this.marker.on('click', () => this.toggleDisplayTrips() );

        this.marker.addTo(map);
    }

    add_starting_trips(trips) {
        this.trips_starting_here.push(trips);
        this.combined_starting_trip_counts.add(trips.trip_counts);
    }

    add_ending_trips(trips) {
        this.trips_ending_here.push(trips);
        this.combined_ending_trip_counts.add(trips.trip_counts);
        if (trips.is_round_trip) {
            this.round_trip_count += trips.trip_counts.total;
        }
    }

    createPopupContent() {
        return `
            <h3>${this.name}</h3>
            <ul>
                <li><b>Trips starting here:</b> ${this.combined_starting_trip_counts.total}</li>
                <li><b>Trips ending here:</b> ${this.combined_ending_trip_counts.total}</li>
                <li><b>Round trips:</b> ${this.round_trip_count}</li>
            </ul>`.trim();
    }

    toggleDisplayTrips() {
        // Clear existing lines
        if (this.lines.length > 0) {
            this.lines.forEach(line => line.remove());
            this.decorators.forEach(decorator => decorator.remove());
            this.lines = [];
            this.decorators = [];
            return;
        }

        // Draw new lines for trips starting from this station
        this.trips_starting_here.forEach(trip => {
            if (trip.is_round_trip) { return; }

            let destination = trip.end_station;
            let pointA = new L.LatLng(this.lat, this.lng);
            let pointB = new L.LatLng(destination.lat, destination.lng);
            let lineColor = "#523BE4";
            let lineWeight = Math.max(1, trip.trip_counts.total / 10); // Scale line weight

            let polyline = L.polyline([pointA, pointB], {
                color: lineColor,
                weight: lineWeight
            });

            // Adding arrows to the polyline
            let decorator = L.polylineDecorator(polyline, {
                patterns: [
                    {offset: '100%', repeat: 0, symbol: L.Symbol.arrowHead({pixelSize: 15, polygon: false, pathOptions: {stroke: true}})}
                ]
            });

            polyline.addTo(this.map);
            decorator.addTo(this.map);

            this.lines.push(polyline);
            this.decorators.push(decorator);
        });
    }

}

document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('map').setView([37.82, -122.27], 14); // Coordinates for Oakland

    // Add CartoDB Positron tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors, © CARTO'
    }).addTo(map);

    // Fetch the JSON data for stations
    fetch('data/prepared/202404-baywheels-tripdata.json')
    .then(response => response.json())
    .then(data => {
        var stations = new Map();

        data.stations.forEach(function(stn) {
            var station = new Station(stn.id, stn.name, stn.lat, stn.lng, map);
            stations.set(station.id, station);
        });

        data.aggregated_trips.forEach(function(trip_data) {
            new Trips(stations, trip_data);
        });
    });
});
