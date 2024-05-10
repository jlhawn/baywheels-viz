import csv
import json

from collections import Counter, defaultdict

TRIP_DATA_CSV_FILE = '202404-baywheels-tripdata.csv'
# File has the following columns:
# - ride_id
# - rideable_type
# - started_at
# - ended_at
# - start_station_name
# - start_station_id
# - end_station_name
# - end_station_id
# - start_lat
# - start_lng
# - end_lat
# - end_lng
# - member_casual

TRIP_DATA_JSON_FILE = '202404-baywheels-tripdata.json'

# Read the CSV data
stations_by_id = {}
trip_counts = Counter()

complete_count, incomplete_count = 0, 0
ride_types = set()
member_types = set()

with open(TRIP_DATA_CSV_FILE, 'r') as file:
    reader = csv.DictReader(file)
    for row in reader:
        start_id = row['start_station_id']
        end_id = row['end_station_id']

        if not (start_id and end_id):
            incomplete_count += 1
            continue # Skip incomplete data

        complete_count += 1

        # Process stations
        if start_id not in stations_by_id:
            stations_by_id[start_id] = {
                'id': start_id,
                'name': row['start_station_name'],
                'lat': row['start_lat'],
                'lng': row['start_lng']
            }
        if end_id not in stations_by_id:
            stations_by_id[end_id] = {
                'id': end_id,
                'name': row['end_station_name'],
                'lat': row['end_lat'],
                'lng': row['end_lng']
            }

        # Aggregate trips
        ride_type = row['rideable_type']
        member_type = row['member_casual']

        ride_types.add(ride_type)
        member_types.add(member_type)

        trip_key = (start_id, end_id, ride_type, member_type)
        trip_counts[trip_key] += 1

stations = list(stations_by_id.values())

# Post-process trip counts
trips_by_start_end = defaultdict(lambda: defaultdict(Counter))
for (start_id, end_id, ride_type, member_type), count in trip_counts.items():
    trips_by_start_end[(start_id, end_id)]['any']['any'] += count
    trips_by_start_end[(start_id, end_id)]['any'][member_type] += count
    trips_by_start_end[(start_id, end_id)][ride_type]['any'] += count
    trips_by_start_end[(start_id, end_id)][ride_type][member_type] += count

trips = []
for (start_id, end_id), counts_by_ride_type in trips_by_start_end.items():
    trip = {
        'start_station_id': start_id,
        'end_station_id': end_id,
        'trip_counts': {
            'total': counts_by_ride_type['any']['any'],
            'by_ride_type': {
                ride_type: counts_by_ride_type[ride_type]['any'] for ride_type in ride_types
            },
            'by_member_type': {
                member_type: counts_by_ride_type['any'][member_type] for member_type in member_types
            },
            'by_ride_type_and_member_type': {
                ride_type: {
                    member_type: counts_by_ride_type[ride_type][member_type] for member_type in member_types
                } for ride_type in ride_types
            }
        }
    }
    trips.append(trip)

stations.sort(key=lambda s: s['id'])
trips.sort(key=lambda t: t['trip_counts']['total'], reverse=True)

prepared_data = {
    'stations': stations,
    'aggregated_trips': trips,
}

with open(TRIP_DATA_JSON_FILE, 'w') as file:
    json.dump(prepared_data, file, indent='  ')
