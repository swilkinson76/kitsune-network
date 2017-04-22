function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function() {
  ajax({
    method: 'GET',
    relativeURL: '/json/data.json',
    success: function(json) {
      fillSelectWithOptions(document.getElementById('inputFavSong'), json.songs);
      fillSelectWithOptions(document.getElementById('inputCommunities'), json.communities);
    },
    error: function() {
      // There was a connection error of some sort
    }
  });
});

function fillSelectWithOptions(select, options) {
  for (var optionIndex in options) {
    // continue if the property is from prototype
    if (!options.hasOwnProperty(optionIndex)) continue;
    var option = document.createElement('option');
    option.value = optionIndex;
    option.innerHTML = options[optionIndex];
    select.appendChild(option);
  }
}

function openModal(contentDiv) {
  document.getElementById('modal_content').innerHTML = contentDiv.innerHTML;
  document.getElementById('modal').style.display = "block";
}

function openModalForm() {
  openModal(document.getElementById('newPinFormContent'));
}

function closeModal() {
  document.getElementById('modal').style.display = "none";
}

var map, newPinMarker, newMarkerWindow, markerInfoWindow;

function initMap() {

  var japan = {lat: 36.2048, lng: 138.2529};
  map = new google.maps.Map(document.getElementById('map'), {
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    center: japan,
    zoom: 5,
    styles:
     [{"elementType":"geometry","stylers":[{"color":"#212121"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#212121"}]},{"featureType":"administrative","elementType":"geometry","stylers":[{"color":"#757575"}]},{"featureType":"administrative.country","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]},{"featureType":"administrative.land_parcel","stylers":[{"visibility":"off"}]},{"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"color":"#bdbdbd"}]},{"featureType":"administrative.neighborhood","stylers":[{"visibility":"off"}]},{"featureType":"poi","elementType":"labels.text","stylers":[{"visibility":"off"}]},{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"poi.business","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#181818"}]},{"featureType":"poi.park","elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"featureType":"poi.park","elementType":"labels.text.stroke","stylers":[{"color":"#1b1b1b"}]},{"featureType":"road","elementType":"geometry.fill","stylers":[{"color":"#c50000"}]},{"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#c50000"}]},{"featureType":"road","elementType":"labels","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"road","elementType":"labels.text.fill","stylers":[{"color":"#8a8a8a"}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#373737"}]},{"featureType":"road.arterial","elementType":"geometry.fill","stylers":[{"color":"#c50000"}]},{"featureType":"road.arterial","elementType":"geometry.stroke","stylers":[{"color":"#c50000"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#3c3c3c"}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#c50000"}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#c50000"}]},{"featureType":"road.highway.controlled_access","elementType":"geometry","stylers":[{"color":"#4e4e4e"}]},{"featureType":"road.highway.controlled_access","elementType":"geometry.fill","stylers":[{"color":"#c50000"}]},{"featureType":"road.highway.controlled_access","elementType":"geometry.stroke","stylers":[{"color":"#c50000"}]},{"featureType":"road.local","elementType":"geometry.fill","stylers":[{"color":"#c50000"}]},{"featureType":"road.local","elementType":"geometry.stroke","stylers":[{"color":"#c50000"}]},{"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"featureType":"transit","stylers":[{"visibility":"off"}]},{"featureType":"transit","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#000000"}]},{"featureType":"water","elementType":"labels.text","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#3d3d3d"}]}]
  });

  setupBottomCenterControl(map);
  var logoDiv = document.createElement('div');
  logoDiv.style['color'] = 'white';
  logoDiv.innerHTML = "<h1>Kitsune Network!</h1>";
  map.controls[google.maps.ControlPosition.TOP].push(logoDiv);

  newMarkerWindow = new google.maps.InfoWindow({
    content: document.getElementById('newPinMessage')
  })
  google.maps.event.addListener(newMarkerWindow, 'closeclick', function() {
    newPinMarker.setMap(null);
  });

  // get and setup markers
  ajax({
    method: 'GET',
    relativeURL: '/pins',
    success: setupMarkers,
    error: function() {
      // There was a connection error of some sort
    }
  });

  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      map.setCenter(pos);
    }, function() {
      // User probbaly did not give permission for their location
    });
  } else {
    // Browser doesn't support Geolocation
  }

}

function setupMarkers(json) {
  var markers = json.map(function(pin, i) {
    var location = {lat: pin.lat, lng: pin.lng};
    var marker =  new google.maps.Marker({
      position: location,
    });
    marker.addListener('click', function() {
      showPinInfoWindow(pin, marker);
    });
    return marker;
  });
  var markerCluster = new MarkerClusterer(map, markers,
      {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
}

function showPinInfoWindow(pin, marker) {
  ajax({
    method: 'GET',
    relativeURL: '/pin/' + pin.id,
    success: function(json) {
      var content = document.createElement('div');
      for (var jsonKey in json) {
        // continue if the property is from prototype
        if (!json.hasOwnProperty(jsonKey)) continue;
        var p = document.createElement('p');
        p.innerHTML = jsonKey + ": " + json[jsonKey];
        content.appendChild(p);
      }
      if (markerInfoWindow !== undefined) {
        markerInfoWindow.close()
      }
      markerInfoWindow = new google.maps.InfoWindow({
        content: content
      })
      markerInfoWindow.open(map, marker);
    },
    error: function() {
      // There was a connection error of some sort
    }
  });
}

function setupBottomCenterControl(map) {

  var controlDiv = document.createElement('div');
  controlDiv.style['padding-bottom'] = '10px';
  controlDiv.style.clear = 'both';

  var addPinUI = document.createElement('div');
  addPinUI.id = 'addPinUI';
  controlDiv.appendChild(addPinUI);
  var addPinText = document.createElement('div');
  addPinText.id = 'addPinText';
  addPinText.innerHTML = 'Add Pin';
  addPinUI.appendChild(addPinText);

  var showAboutUI = document.createElement('div');
  showAboutUI.id = 'showAboutUI';
  controlDiv.appendChild(showAboutUI);
  var showAboutText = document.createElement('div');
  showAboutText.id = 'showAboutText';
  showAboutText.innerHTML = 'About';
  showAboutUI.appendChild(showAboutText);

  addPinUI.addEventListener('click', function() {
    if (newPinMarker !== undefined) {
      newPinMarker.setMap(null);
    }
    newPinMarker = new google.maps.Marker({
      position: map.getCenter(),
      map: map,
      animation: google.maps.Animation.DROP,
      draggable:true
    });
    newMarkerWindow.open(map, newPinMarker);
    document.getElementById('newPinMessage').style.display = "block";
  });

  showAboutUI.addEventListener('click', function() {
    openModal(document.getElementById('aboutContent'));
  });

  map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(controlDiv);

}

function sendActivationEmail() {
  var data = new QueryStringBuilder();
  data.add("name", document.getElementById('inputName').value);
  data.add("about_you", document.getElementById('inputAboutYou').value);
  data.add("email", document.getElementById('inputEmail').value);
  data.add("pin_icon", document.getElementById('inputPinIcon').value);
  data.add("favorite_member", document.getElementById('inputFavMember').value);
  data.add("favorite_song", document.getElementById('inputFavSong').value);
  data.add("communities", getSelectValues(document.getElementById('inputCommunities')));
  var latlng = newPinMarker.getPosition();
  data.add("latitude", latlng.lat());
  data.add("longitude", latlng.lng());

  ajax({
    method: 'POST',
    relativeURL: '/pin',
    data: data,
    success: function(json) {
      newMarkerWindow.close();
      newPinMarker.setMap(null);
      openModal(document.getElementById('emailSentMessage'));
    },
    error: function() {
      // There was a connection error of some sort
    }
  });

}

function getSelectValues(select) {
  var result = [];
  var options = select && select.options;
  var opt;

  for (var i=0, iLen=options.length; i<iLen; i++) {
    opt = options[i];

    if (opt.selected) {
      result.push(opt.value || opt.text);
    }
  }
  return result;
}

function QueryStringBuilder() {
  var nameValues = [];
  this.add = function(name, value) {
    nameValues.push( {name: name, value: value} );
  };
  this.toQueryString = function() {
    var segments = [], nameValue;
    for (var i = 0, len = nameValues.length; i < len; i++) {
        nameValue = nameValues[i];
        segments[i] = encodeURIComponent(nameValue.name) + "=" + encodeURIComponent(nameValue.value);
    }
    return segments.join("&");
  };
}

function ajax(settings) {
  var request = new XMLHttpRequest();
  request.open(settings.method, settings.relativeURL, true);
  if (settings.method == 'POST') {
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
  }
  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      var json = JSON.parse(request.responseText);
      settings.success(json)
    } else {
      // We reached our target server, but it returned an error
      settings.error();
    }
  };
  request.onerror = settings.error;
  if (settings.method == 'POST') {
    request.send(settings.data.toQueryString());
  } else {
    request.send();
  }
}
