

function SimpleGoogleMap ( data ) {
	( { node, markers, ...params } = data );
	node.simpleGoogleMap = this;
	this.node = node;
	this.markers = markers;
	this.params = params;
	this.geocoder = new google.maps.Geocoder();

	if ( typeof( this.params.center ) === 'string' ) {
		this.map = new google.maps.Map( this.node, { ...this.params, center: { lat: 0, lng: 0 } } );
		this.setCenter( this.params.center );
	} else {
		this.map = new google.maps.Map( this.node, this.params );
	}

	this.procMarkers();

	return this;
}

SimpleGoogleMap.prototype.setCenter = function ( str ) {
	this.getPosition( str, ( function ( position ) {
		this.params.center = position;
		this.map.setCenter( this.params.center );
	}).bind( this ));
};

SimpleGoogleMap.prototype.procMarkers = function () {
	if ( this.markers instanceof Object && Object.getOwnPropertyNames( this.markers ).length > 0 ) {
		for ( let id in this.markers ) {
			let marker = this.markers[ id ];

			if ( typeof( marker.position ) === 'string' ) {
				this.getPosition( marker.position, ( function ( position ) {
					marker.position = position;
					this.setMarker( id );
				}).bind( this ));
			} else {
				this.setMarker( id );
			}
		}
	}
};

SimpleGoogleMap.prototype.setMarker = function ( id ) {
	let marker = this.markers[id];

	marker.instance = new google.maps.Marker({
		map: this.map,
		...marker
	});

	if ( marker.html ) {
		marker.info = new google.maps.InfoWindow({
			content: marker.html
		});

		marker.instance.addListener( 'click', ( function() {
			for ( let key in this.markers ) {
				if ( typeof( this.markers[key].info ) !== 'undefined' ) {
					this.markers[ key ].info.close();
				}
			}

			marker.info.open( this.map, marker.instance );
		}).bind( this ));
	}
};

SimpleGoogleMap.prototype.addMarker = function ( id, params ) {
	let marker = this.markers[id] = params;

	if ( typeof( marker.position ) === 'string' ) {
		this.getPosition( marker.position, ( function ( position ) {
			marker.position = position;
			this.setMarker( id );
		}).bind( this ));
	} else {
		this.setMarker( id );
	}
};

SimpleGoogleMap.prototype.delMarker = function ( id ) {
	this.markers[id].instance.setMap( null );
	delete this.markers[id];
};

SimpleGoogleMap.prototype.hideMarker = function ( id ) {
	this.markers[id].instance.setMap( null );
};

SimpleGoogleMap.prototype.showMarker = function ( id ) {
	this.markers[id].instance.setMap( this.map );
};

SimpleGoogleMap.prototype.getPosition = function ( str, cb ) {
	this.geocoder.geocode( { address: str }, ( function( results, status ) {
		if ( status === 'OK' ) {
			cb( results[0].geometry.location );
		} else if ( status === 'OVER_QUERY_LIMIT' ) {
			setTimeout( this.getPosition.bind( this, str, cb ), 1000 );
		} else {
			console.warn( status, str );
		}
	}).bind( this ));
};

SimpleGoogleMap.prototype.showInfo = function ( id ) {
	for ( let key in this.markers ) {
		if ( typeof( this.markers[key].info ) !== 'undefined' ) {
			this.markers[key].info.close();
		}
	}

	if ( typeof( this.markers[ id ] ) !== 'undefined' ) {
		this.markers[ id ].info.open( this.map, this.markers[ id ].instance );
	}
};

SimpleGoogleMap.prototype.search = function ( str ) {
	for ( let id in this.markers ) this.delMarker( id );

	this.getPosition( str, ( function ( position ) {
		this.map.setCenter( position );
		this.addMarker( str, { position: position } );
	}).bind( this ));
};

SimpleGoogleMap.prototype.filter = function ( tags ) {
	let
		ids = Object.getOwnPropertyNames( this.markers ),
		filtered = [];

	if ( tags.includes( '*' ) ) {
		filtered = ids;
	} else {
		filtered = ids.filter( ( function( id ) {
			let marker = this.markers[id];
			for ( let i = 0; i < marker.tags.length; i++ ) if ( tags.includes( marker.tags[i] ) ) return true;
			return false;
		}).bind( this ));
	}

	for ( let id in this.markers ) {
		if ( filtered.includes( id ) ) this.showMarker( id );
		else this.hideMarker( id );
	}
};


/////////////////////////////////////////////////////////////////////////////////////////////

// function initMap() {
//     var map = new google.maps.Map(document.getElementById('map'), {
//         center: {lat: -34.397, lng: 150.644},
//         zoom: 6
//     });
//     var input = document.getElementById('autocomplete');
//     var autocomplete = new google.maps.places.Autocomplete(input);

//     // Bind the map's bounds (viewport) to the autocomplete object,
//     // so that the autocomplete requests use the current map bounds for the
//     // bounds option in the request.
//     autocomplete.bindTo('bounds', map);

//     autocomplete.addListener('place_changed', function() {
//         var place = autocomplete.getPlace();
//         if (!place.geometry) {
//             window.alert("No details available for input: '" + place.name + "'");
//             return;
//         }

//         // If the place has a geometry, then present it on a map.
//         if (place.geometry.viewport) {
//             map.fitBounds(place.geometry.viewport);
//         } else {
//             map.setCenter(place.geometry.location);
//             map.setZoom(17);  // Why 17? Because it looks good.
//         }
//     });
// }
function sendDataToServer(data) {
	fetch('/store-data', {
	  method: 'POST',
	  headers: {
		'Content-Type': 'application/json',
	  },
	  body: JSON.stringify(data)
	})
	.then(response => response.json())
	.then(data => console.log('Data sent successfully:', data))
	.catch((error) => console.error('Error:', error));
  }

var autocomplete

function initAutocomplete() {
    // Create the autocomplete object, restricting the search to geographical location types.
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById('autocomplete'), {types: ['geocode'], componentRestrictions: { country: 'IE' }});

    // When the user selects an address from the dropdown, populate the address fields in the form.
    autocomplete.addListener('place_changed', function() {
		var place = autocomplete.getPlace()
		var place_id = place.place_id;
		var formattedAddress = place.formatted_address
		sendDataToServer({address: formattedAddress})
		fetch(`/nearest_homes/${place_id}`)
			.then(response => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.json();  // Make sure to return the result of response.json()
			})
			.then(homes_array => {  // This 'then' handles the resolved Promise from response.json()
				console.log(homes_array);
				const home_options_dropdown = document.getElementById('home_options');
				home_options_dropdown.innerHTML = '';
	
				// Loop through homes_array and create option elements
				homes_array.forEach(home => {
					// Create a new <option> element
					const option = document.createElement('option');
					option.value = home.name;  // You could also use home.distance or a combination of both as value
					option.text = `${home.name} - ${home.distance} km`;  // Setting the text to show in the dropdown
	
					// Append the new option to the dropdown
					home_options_dropdown.appendChild(option);
				});
			})
			.catch(error => {
				console.error('Fetch error:', error);
			});
	});
	
}

function geolocate() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            var geolocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            var circle = new google.maps.Circle(
                {center: geolocation, radius: position.coords.accuracy});
            autocomplete.setBounds(circle.getBounds());
        });
    }
}

window.onload = function() {
    initAutocomplete();
};
