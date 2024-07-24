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

/////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', () => {

    function getCookies() {
        const cookies = document.cookie.split('; ');
        const cookieObj = {};
        cookies.forEach(cookie => {
            const [name, value] = cookie.split('=');
            cookieObj[decodeURIComponent(name)] = decodeURIComponent(value);
        });
        return cookieObj;
    }
    
    // Function to get a specific cookie by name
    function getCookie(name) {
        const cookieObj = getCookies();
        return cookieObj[name]; // Directly return the value of the specified cookie
    }

    const createPictureInputGroup = (inputContainer, type) => {
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add(type + '-input-group');
    
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'name[]'; 
        nameInput.placeholder = 'Enter name';
        nameInput.required = true;
    
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.name = 'price[]';
        priceInput.placeholder = 'Enter price';
        priceInput.required = true;
    
        // File upload label/button
        const fileLabel = document.createElement('label');
        fileLabel.textContent = 'Upload Image';
        fileLabel.classList.add('custom-file-upload');
    
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.name = 'image[]';
        fileInput.accept = 'image/*';
        fileInput.required = true;
        fileInput.style.display = 'none';
    
        // Image display area
        const imageDisplay = document.createElement('img');
        imageDisplay.style.width = '200px'; // Adjust as needed
        imageDisplay.style.display = 'none'; // Initially hide the image display
        imageDisplay.style.objectFit = 'cover';
        imageDisplay.style.height = '100%';
    
        fileLabel.appendChild(fileInput);
        
    
        // Event listener for file input to update the image display
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    imageDisplay.src = e.target.result;
                    imageDisplay.style.display = 'block'; // Show the image
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.classList.add('remove-button');
        removeButton.textContent = '-';
    
        removeButton.addEventListener('click', () => {
            inputContainer.removeChild(newInputGroup);
        });
    
        newInputGroup.appendChild(nameInput);
        newInputGroup.appendChild(priceInput);
        newInputGroup.appendChild(fileLabel);
        newInputGroup.appendChild(removeButton);
        newInputGroup.appendChild(imageDisplay);
        inputContainer.appendChild(newInputGroup);
    };
    

    const createPictureInputGroupCustom = (inputContainer, type, name = '', price = '', img_path = '') => {
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add(type + '-input-group');
    
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'name[]';
        nameInput.placeholder = 'Enter name';
        nameInput.value = name;
        nameInput.required = true;
    
        const priceInput = document.createElement('input');
        priceInput.type = 'number';
        priceInput.name = 'price[]';
        priceInput.placeholder = 'Enter price';
        priceInput.value = price;
        priceInput.required = true;
    
        // File upload label/button
        const fileLabel = document.createElement('label');
        fileLabel.textContent = 'Upload Image';
        fileLabel.classList.add('custom-file-upload');
    
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.name = 'image[]';
        fileInput.accept = 'image/*';
        fileInput.required = false;
        fileInput.style.display = 'none';  // Hide the actual file input
    
        // Image display area
        const imageDisplay = document.createElement('img');
        imageDisplay.style.width = '100px';  // Adjust as needed
        if (img_path) {
            imageDisplay.src = img_path;
            imageDisplay.alt = 'Uploaded Image';
        }
    
        fileLabel.appendChild(fileInput);
        
    
        // Event listener for file input to update the image display
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    imageDisplay.src = e.target.result;
                    imageDisplay.alt = 'Newly Uploaded Image';
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
    
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.classList.add('remove-button');
        removeButton.textContent = '-';
    
        removeButton.addEventListener('click', () => {
            inputContainer.removeChild(newInputGroup);
        });
    
        newInputGroup.appendChild(nameInput);
        newInputGroup.appendChild(priceInput);
        newInputGroup.appendChild(fileLabel);
        newInputGroup.appendChild(removeButton);
        newInputGroup.appendChild(imageDisplay);
        inputContainer.appendChild(newInputGroup);
    };
    
    


    const createAddressInputGroup = (inputContainer, type) => {
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add(type + '-input-group');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'name[]';
        nameInput.placeholder = 'Enter name';
        nameInput.required = true;

        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.name = 'address[]';
        addressInput.placeholder = 'Enter address';
        addressInput.required = true;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.classList.add('remove-button');
        removeButton.textContent = '-';

        removeButton.addEventListener('click', () => {
            inputContainer.removeChild(newInputGroup);
        });

        newInputGroup.appendChild(nameInput);
        newInputGroup.appendChild(addressInput);
        newInputGroup.appendChild(removeButton);
        inputContainer.appendChild(newInputGroup);
    };

    const createAddressInputGroupCustom = (inputContainer, type, initialName = '', initialAddress = '') => {
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add(type + '-input-group');
    
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.name = 'name[]';
        nameInput.placeholder = 'Enter name';
        nameInput.value = initialName;  // Set default or initial name if provided
        nameInput.required = true;
    
        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.name = 'address[]';
        addressInput.placeholder = 'Enter address';
        addressInput.value = initialAddress;  // Set default or initial address if provided
        addressInput.required = true;
    
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.classList.add('remove-button');
        removeButton.textContent = '-';
    
        removeButton.addEventListener('click', () => {
            inputContainer.removeChild(newInputGroup);
        });
    
        newInputGroup.appendChild(nameInput);
        newInputGroup.appendChild(addressInput);
        newInputGroup.appendChild(removeButton);
        inputContainer.appendChild(newInputGroup);
    };
    


    const coffinInputContainer = document.getElementById('coffin-input-container');
    const coffinAddButton = document.getElementById('coffin-add-button');

    const flowerInputContainer = document.getElementById('flower-input-container');
    const flowerAddButton = document.getElementById('flower-add-button');

    // Function to create a new input group
    

    // Event listener for the add button
    coffinAddButton.addEventListener('click', (e) => {
        e.preventDefault();
        createPictureInputGroup(coffinInputContainer, 'coffin');
    });

    

    // Event listener for the add button
    flowerAddButton.addEventListener('click', (e) => {
        e.preventDefault();
        createPictureInputGroup(flowerInputContainer,'flower');
    });

    // GETTING THE PROVIDERID through cookie!
    const providerId = getCookie('providerId')
    //////////////////////////////////////////////
        
    if (providerId) {
        fetch(`/flowers/${providerId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(flowers => {
                // Assuming 'flowers' is an array of flower objects
                const flowerInputContainer = document.getElementById('flower-input-container');
                flowers.forEach((flower, index) => {
                    createPictureInputGroupCustom(flowerInputContainer, 'flower', flower.name, flower.price, flower.imgPath);
                });
            })
            .catch(error => console.error('Error fetching flowers:', error));

        fetch(`/coffins/${providerId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(coffins => {
                // Assuming 'flowers' is an array of coffin objects
                const coffinInputContainer = document.getElementById('coffin-input-container');
                coffins.forEach((coffin, index) => {
                    createPictureInputGroupCustom(coffinInputContainer, 'coffin', coffin.name, coffin.price, coffin.imgPath);
                });
            })
            .catch(error => console.error('Error fetching coffins:', error));
        
        fetch(`/church/${providerId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(churches => {
                // Assuming 'flowers' is an array of church objects
                const churchInputContainer = document.getElementById('church-input-container');
                churches.forEach((church, index) => {
                    createAddressInputGroupCustom(churchInputContainer, 'church', church.name, church.address);
                });
            })
            .catch(error => console.error('Error fetching churchs:', error));
        
        fetch(`/cemetery/${providerId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(cemeteries => {
                // Assuming 'flowers' is an array of cemetery objects
                const cemeteryInputContainer = document.getElementById('cemetery-input-container');
                cemeteries.forEach((cemetery, index) => {
                    createAddressInputGroupCustom(cemeteryInputContainer, 'cemetery', cemetery.name, cemetery.address);
                });
            })
            .catch(error => console.error('Error fetching cemeterys:', error));
    } else {
        console.error('Provider ID not found in cookies.');
    }



    const offeringForm = document.getElementById('offering-form');

    offeringForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission

        const formData = new FormData();

        // Dynamically add entries for coffins
        const coffinInputs = document.querySelectorAll('.coffin-input-group');
        coffinInputs.forEach((input, index) => {
            const nameInput = input.querySelector('[name="name[]"]');
            const priceInput = input.querySelector('[name="price[]"]');
            const fileInput = input.querySelector('[name="image[]"]');

            // Append coffin data to formData
            formData.append(`coffin[${index}][name]`, nameInput.value);
            formData.append(`coffin[${index}][price]`, priceInput.value);
            if (fileInput.files.length > 0) {
                formData.append(`coffin[${index}][image]`, fileInput.files[0]);
            } else {
                formData.append(`coffin[${index}][image]`, ''); // Append a blank string if no file is uploaded
            }
        });

        const flowerInputs = document.querySelectorAll('.flower-input-group');
        flowerInputs.forEach((input, index) => {
            const nameInput = input.querySelector('[name="name[]"]');
            const priceInput = input.querySelector('[name="price[]"]');
            const fileInput = input.querySelector('[name="image[]"]');

            // Append flower data to formData
            formData.append(`flower[${index}][name]`, nameInput.value);
            formData.append(`flower[${index}][price]`, priceInput.value);
            if (fileInput.files.length > 0) {
                formData.append(`flower[${index}][image]`, fileInput.files[0]);
            } else {
                formData.append(`flower[${index}][image]`, ''); // Append a blank string if no file is uploaded
            }
        });
        // Repeat the pattern above for flowers or any other categories


        fetch('/update-offering?type=items', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Include cookies in the request if needed for authentication
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server responded with a status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            alert('Offerings updated successfully!');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to update offerings.');
        });

    });

    const cemeteryInputContainer = document.getElementById('cemetery-input-container');
    const cemeteryAddButton = document.getElementById('cemetery-add-button');

    // Event listener for the add button
    cemeteryAddButton.addEventListener('click', (e) => {
        e.preventDefault();
        createAddressInputGroup(cemeteryInputContainer, 'cemetery');
    });


    const churchInputContainer = document.getElementById('church-input-container');
    const churchAddButton = document.getElementById('church-add-button');

    // Event listener for the add button
    churchAddButton.addEventListener('click', (e) => {
        e.preventDefault();
        createAddressInputGroup(churchInputContainer,'church');
    });



    const placesForm = document.getElementById('places-form');

    placesForm.addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the default form submission

        const formData = new FormData();

        // Dynamically add entries for coffins
        const churchInputs = document.querySelectorAll('.church-input-group'); // Make sure your inputs are within divs with this class
        churchInputs.forEach((input, index) => {
            const nameInput = input.querySelector('[name="name[]"]');
            const addressInput = input.querySelector('[name="address[]"]');

            // Append church data to formData
            formData.append(`church[${index}][name]`, nameInput.value);
            formData.append(`church[${index}][address]`, addressInput.value);
        });

        const cemeteryInputs = document.querySelectorAll('.cemetery-input-group'); // Make sure your inputs are within divs with this class
        cemeteryInputs.forEach((input, index) => {
            const nameInput = input.querySelector('[name="name[]"]');
            const addressInput = input.querySelector('[name="address[]"]');

            // Append cemetery data to formData
            formData.append(`cemetery[${index}][name]`, nameInput.value);
            formData.append(`cemetery[${index}][address]`, addressInput.value);
        });
        // Repeat the pattern above for flowers or any other categories

        
        fetch('/update-offering?type=places', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Include cookies in the request if needed for authentication
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server responded with a status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('Success:', data);
            alert('Offerings updated successfully!');
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to update offerings.');
        });

    });









    ///////////////////////////////////////////////////////////////////////
    //Their own radio questions
    const form = document.getElementById('radio-question-form');
    const questionContainer = document.getElementById('question-container');
    const addQuestionButton = document.getElementById('question-add-button');

    // Function to create a new radio option input group
    const createRadioOptionInputGroup = (optionContainer) => {
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add('input-group');

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = `option-${optionContainer.dataset.questionId}`;
        radioInput.required = true;

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.name = `option-text-${optionContainer.dataset.questionId}[]`;
        textInput.placeholder = 'Enter option text';
        textInput.required = true;

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.classList.add('remove-button');
        removeButton.textContent = '-';

        removeButton.addEventListener('click', () => {
            optionContainer.removeChild(newInputGroup);
        });

        newInputGroup.appendChild(radioInput);
        newInputGroup.appendChild(textInput);
        newInputGroup.appendChild(removeButton);
        optionContainer.appendChild(newInputGroup);
    };

    // Function to create a new question container with options
    const createQuestionContainer = (questionContainer) => {
        const newQuestionGroup = document.createElement('div');
        newQuestionGroup.classList.add('question-group');

        const questionInput = document.createElement('input');
        questionInput.type = 'text';
        questionInput.name = 'questions[]';
        questionInput.placeholder = 'Enter your question';
        questionInput.required = true;

        const optionContainer = document.createElement('div');
        optionContainer.classList.add('option-container');
        optionContainer.dataset.questionId = Date.now();

        const addOptionButton = document.createElement('button');
        addOptionButton.type = 'button';
        addOptionButton.classList.add('option-add-button');
        addOptionButton.textContent = 'Add Option';

        addOptionButton.addEventListener('click', (e) => {
            e.preventDefault();
            createRadioOptionInputGroup(optionContainer);
        });

        const removeQuestionButton = document.createElement('button');
        removeQuestionButton.type = 'button';
        removeQuestionButton.classList.add('remove-button');
        removeQuestionButton.textContent = 'Remove Question';

        removeQuestionButton.addEventListener('click', () => {
            questionContainer.removeChild(newQuestionGroup);
        });

        newQuestionGroup.appendChild(questionInput);
        newQuestionGroup.appendChild(optionContainer);
        newQuestionGroup.appendChild(addOptionButton);
        newQuestionGroup.appendChild(removeQuestionButton);
        questionContainer.appendChild(newQuestionGroup);

        // Initially add the first option input group
        createRadioOptionInputGroup(optionContainer);
    };

    // Event listener for the add question button
    addQuestionButton.addEventListener('click', (e) => {
        e.preventDefault();
        createQuestionContainer(questionContainer);
    });


    var calendarEl = document.getElementById('calendar');
    var selectedEvent = null;  // Variable to hold the currently selected event

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',  // Shows the weekly view
        selectable: true,  // Allow users to select time ranges
        selectMirror: true,
        select: function(arg) {
            // Log the selection and add it to the calendar
            console.log(`Selected from ${arg.startStr} to ${arg.endStr}`);
            calendar.addEvent({
                title: 'Unavailable',
                start: arg.start,
                end: arg.end,
                allDay: arg.allDay
            });
            calendar.unselect();
        },
        eventClick: function(info) {
            // Toggle selection state
            if (selectedEvent) {
                selectedEvent.setProp('backgroundColor', '');  // Reset previous selected event color
            }
            selectedEvent = info.event;
            selectedEvent.setProp('backgroundColor', '#ff9f89');  // Highlight selected event
        },
        editable: true,  // Allow drag and drop
        eventSources: [
            `/calendar-source/${providerId}`  // Load existing events
        ]
    });

    calendar.render();

    // Listen for delete key presses
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Delete' && selectedEvent) {
                selectedEvent.remove();  // Removes the event from the calendar
                selectedEvent = null;  // Clear the selection
        }
    });

    document.getElementById('confirmButton').addEventListener('click', function() {
        var events = calendar.getEvents();
        var eventData = events.map(event => ({
            title: event.title,
            start: event.start.toISOString(), // or format as needed
            end: event.end.toISOString(),    // or format as needed
            allDay: event.allDay
        }));

        console.log(eventData); // For demonstration, log the data to the console

        // Optionally, send this data to the server
        fetch(`/calendar-upload/${providerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        })
        .then(response => response.json())
        .then(data => {
            console.log('Save successful', data);
            alert('Calendar saved');
        })
        .catch(error => {
            console.error('Error saving events:', error);
        });
    });
});
