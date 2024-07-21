'use strict';

// Global components list
let components = {};

// Scrolling function
function scrollToSection(targetId) {
    var element = document.getElementById(targetId);
    if (element) {
        element.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}


components.pageReveal = {
	selector: '.page',
	init: function( nodes ) {
		window.addEventListener( 'components:ready', function () {
			window.dispatchEvent( new Event( 'resize' ) );
			document.documentElement.classList.add( 'components-ready' );

			nodes.forEach( function( node ) {
				setTimeout( function() {
					node.classList.add( 'page-revealed' );
				}, 500 );
			});
		}, { once: true } );

		window.addEventListener( 'components:stylesReady', function () {
		}, { once: true } );
	}
};
components.isotope = {
	selector: '.isotope-wrap',
	styles: './components/isotope/isotope.css',
	script: [
		'./components/jquery/jquery-3.6.0.min.js',
		'./components/isotope/isotope.min.js'
	],
	init: function ( nodes ) {
		function setFilterActive ( filterGroup, activeItem ) {
			if ( !activeItem.classList.contains( 'active' ) ) {
				for ( let n = 0; n < filterGroup.length; n++ ) filterGroup[ n ].classList.remove( 'active' );
				activeItem.classList.add( 'active' );
			}
		}

		nodes.forEach( function ( node ) {
			let
					isotopeItem = $( '.isotope' ),
					isotopeFilters = node.querySelectorAll( '[data-isotope-filter]' );

			isotopeItem.isotope({
				itemSelector: '.isotope-item',
				masonry: {
					columnWidth: 30
				}
			});

			isotopeFilters.forEach( function ( filter ) {
				filter.addEventListener( 'click', function () {
					setFilterActive( isotopeFilters, filter );
					isotopeItem.isotope( {
						filter: $( this ).attr( 'data-isotope-filter' )
					} );
				} );
			} );
		});
	}
};

/**
 * Wrapper to eliminate json errors
 * @param {string} str - JSON string
 * @returns {object} - parsed or empty object
 */
function parseJSON ( str ) {
	try {
		if ( str )  return JSON.parse( str );
		else return {};
	} catch ( error ) {
		console.warn( error );
		return {};
	}
}

/**
 * Get tag of passed data
 * @param {*} data
 * @return {string}
 */
function objectTag ( data ) {
	return Object.prototype.toString.call( data ).slice( 8, -1 );
}

/**
 * Merging of two objects
 * @param {Object} source
 * @param {Object} merged
 * @return {Object}
 */
function merge( source, merged ) {
	for ( let key in merged ) {
		let tag = objectTag( merged[ key ] );

		if ( tag === 'Object' ) {
			if ( typeof( source[ key ] ) !== 'object' ) source[ key ] = {};
			source[ key ] = merge( source[ key ], merged[ key ] );
		} else if ( tag !== 'Null' ) {
			source[ key ] = merged[ key ];
		}
	}

	return source;
}

/**
 * Strict merging of two objects. Merged only parameters from the original object and with the same data type. Merge only simple data types, arrays and objects.
 * @param source
 * @param merged
 * @return {object}
 */
function strictMerge( source, merged ) {
	for ( let key in source ) {
		let
			sTag = objectTag( source[ key ] ),
			mTag = objectTag( merged[ key ] );

		if ( [ 'Object', 'Array', 'Number', 'String', 'Boolean', 'Null', 'Undefined' ].indexOf( sTag ) > -1 ) {
			if ( sTag === 'Object' && sTag === mTag ) {
				source[ key ] = strictMerge( source[ key ], merged[ key ] );
			} else if ( mTag !== 'Undefined' && ( sTag === 'Undefined' || sTag === 'Null' || sTag === mTag ) ) {
				source[ key ] = merged[ key ];
			}
		}
	}

	return source;
}

// Main
window.addEventListener( 'load', function () {
	new ZemezCore({
		debug: true,
		components: components,
		observeDOM: window.xMode,
		IEHandler: function ( version ) {
			document.documentElement.classList.add( 'ie-'+ version );
		}
	});
});

document.addEventListener("DOMContentLoaded", function() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    });
  });


  
// document.addEventListener('DOMContentLoaded', function() {
//     console.log(sessionStorage);
//     const formData = JSON.parse(sessionStorage.getItem('formData')); // Retrieve and parse the data
//     const displayArea = document.getElementById('formDataDisplay');

//     if (formData) {
//         // Loop through the stored data and create elements to display it using Bootstrap classes
//         Object.keys(formData).forEach(key => {
//             // Create a new div for each row
//             const rowDiv = document.createElement('div');
//             rowDiv.className = 'row';

//             // Create a column div
//             const colDiv = document.createElement('div');
//             colDiv.className = 'mb-1 col-7 form-centered-col';

//             // Create a paragraph to hold each key-value pair
//             const p = document.createElement('p');
//             p.textContent = `${key}: ${formData[key]}`;

//             // Append the paragraph to the column div, and the column div to the row div
//             colDiv.appendChild(p);
//             rowDiv.appendChild(colDiv);

//             // Append the row div to the display area
//             displayArea.appendChild(rowDiv);
//         });
//     } else {
//         displayArea.textContent = 'No data to display.';
//     }
// });
document.addEventListener('DOMContentLoaded', function() {
    const displayArea = document.getElementById('formDataDisplay');
    const storedFormHTML = sessionStorage.getItem('formHTML');
    
    if (storedFormHTML) {
        displayArea.innerHTML = storedFormHTML;  // Display the form
        
        // Disable all form elements
        const form = displayArea.querySelector('form');
        Array.from(form.elements).forEach(element => element.disabled = true);
    } else {
        displayArea.textContent = 'No form data to display.';
    }
});
