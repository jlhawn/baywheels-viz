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
        let lineWeight = Math.max(2, 2*Math.pow(this.trip_counts.total, 1/3)); // Scale line weight as cube of trips.
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
        let popupContent = `
            <h4>${this.start_station.name} -> ${this.end_station.name}</h4>
            <strong>Total Trips:</strong> ${this.trip_counts.total}<br />
            <strong>Distance:</strong> ${this.distance.toFixed(2)} km<br />
            <ul>
                <li>Classic Bike trips: ${this.trip_counts.by_ride_type.classic_bike}</li>
                <li>Electric Bike trips: ${this.trip_counts.by_ride_type.electric_bike}</li>
                <li>Member trips: ${this.trip_counts.by_member_type.member}</li>
                <li>Non-member trips: ${this.trip_counts.by_member_type.casual}</li>
                <li>Member trips on Classic Bike: ${this.trip_counts.by_ride_type_and_member_type.classic_bike.member}</li>
                <li>Member trips on Electric Bike: ${this.trip_counts.by_ride_type_and_member_type.electric_bike.member}</li>
                <li>Non-member trips on Classic Bike: ${this.trip_counts.by_ride_type_and_member_type.classic_bike.casual}</li>
                <li>Non-member trips on Electirc Bike: ${this.trip_counts.by_ride_type_and_member_type.electric_bike.casual}</li>
            </ul>
        `.trim();

        let popup = 

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
    constructor(id, name, lat, lng, markers_layer, station_trips_layer) {
        this.id = id;
        this.name = name;
        this.lat = parseFloat(lat);
        this.lng = parseFloat(lng);
        this.point = new L.LatLng(this.lat, this.lng);

        this.display_mode = 0;
        this.trips_layer = station_trips_layer;

        this.trips_starting_here = [];
        this.trips_ending_here = [];
        this.round_trip_count = 0;

        this.combined_starting_trip_counts = new TripCounts();
        this.combined_ending_trip_counts = new TripCounts();

        this.marker = L.marker([this.lat, this.lng], {icon: customMarker});
        this.marker.bindPopup(() => this.createPopupContent());

        // Bind events for hover popup and click.
        this.marker.on('mouseover', () => this.marker.openPopup() );
        this.marker.on('click', () => this.toggleDisplayTrips() );

        markers_layer.addLayer(this.marker);
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
            <strong>Trips starting here:</strong> ${this.combined_starting_trip_counts.total}<br />
            <strong>Trips ending here:</strong> ${this.combined_ending_trip_counts.total}<br />
            <strong>Round trips:</strong> ${this.round_trip_count}<br />
        `.trim();
    }

    toggleDisplayTrips() {
        // Clear any existing trips displayed.
        this.trips_layer.clearLayers();

        // 0 -> off, 1 -> trips_out, 2 -> trips_in
        this.display_mode = (this.display_mode + 1) % 3
        switch (this.display_mode) {
        case 1:
            return this.display_trips_out();
        case 2:
            return this.display_trips_in();
        }
    }

    display_trips_out() {
        this.display_trips(this.trips_starting_here);
    }

    display_trips_in() {
        this.display_trips(this.trips_ending_here);
    }

    display_trips(trips) {
        trips.forEach(trip => trip.display(this.trips_layer));
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
