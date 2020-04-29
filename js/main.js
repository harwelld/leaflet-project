/* Scripts - GEOG 575 - project - Dylan Harwell */

// Create Leaflet map with ESRI vector tile basemap and basemap selector
function createMap() {
    
    var map = L.map('map', {
        editable: true,
        doubleClickZoom: false
    }).setView([39.0665, -108.560], 15);
    
    // Custom attribution to map credits section
    map.attributionControl.addAttribution('<a href="https://esri.github.io/esri-leaflet/" target="_blank">Esri Leaflet</a>');
    map.attributionControl.addAttribution('<a href="https://www.w3schools.com/w3css/default.asp" target="_blank">W3 CSS</a>');
    map.attributionControl.addAttribution('Dylan Harwell - UW Madison');
    
    // Trigger Google Street View function if map cursor is crosshair
    map.on('click', function(e) {
        if ($('#map').css('cursor') == 'crosshair') {
            googleStreet(e);
        }
    });
    
    // Add initial vector basemap, set dropdown value, create listener and change function
    var layer = L.esri.Vector.basemap('Navigation').addTo(map);
    L.control.scale({ metric: false, position: 'bottomright' }).addTo(map);
    $('#basemap-selector').val('Navigation');
    $('#basemap-selector').on('change', function(e) {
        var basemap = e.target.value;
        setBasemap(basemap);
    });
        
    function setBasemap(basemap) {
        if (layer) {
            map.removeLayer(layer);
        }
        layer = L.esri.Vector.basemap(basemap).addTo(map);
    }
    
    // Initialize map layers from hosted feature layers
    // Probably much better way to handle symbology on pipe inspections, but hey its like using ArcMap definition queries
    var pipes = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeSymbology
    }).addTo(map);
    var over3Years = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionOver3YearsSymbology
    });
    var under3Years = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionUnder3YearsSymbology
    });
    var under1Year = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspectionUnder1YearSymbology
    });
    var under1Month = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormLines/FeatureServer/0",
        style: pipeInspection1MonthSymbology
    });
    var structures = L.esri.featureLayer({
        url: "https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/StormStructures/FeatureServer/0",
        pointToLayer: function(geojson, latlng) {
            return L.marker(latlng, { icon: structureIcons(geojson) });
        }
    });
    
    // Bind popups to pipes and structures layers
    pipes.bindPopup(function(layer) {
        console.log(layer.feature.properties);
        insDate = new Date(layer.feature.properties.InsDate);
        insDate = insDate.toLocaleDateString('en-US');
        return L.Util.template(pipePopup(insDate), layer.feature.properties);
    });
    structures.bindPopup(function(layer) {
        return L.Util.template(strucPopup(), layer.feature.properties);
    }); 

    // Initialize accordion legend
    var legend = new L.Control.AccordionLegend({
        position: 'topright',
        content: legendContent(pipes, structures, over3Years, under3Years, under1Year, under1Month),
    }).addTo(map);
    legend.toggleLayer('Pipes', 'on');
    
    // Tinker with classes for my use case (could have modified source, but hey jQuery)
    $('.leaflet-control-accordionlegend-button').prop('title', 'Toggle Layers and View Legend')
    $('.leaflet-control-accordionlegend-button').addClass('w3-button');
    $('.accordionlegend-section-title').addClass('w3-button w3-round');
    $('.accordionlegend-slider').hide();
    for (var i=2; i < 6; i++) {
        $('.accordionlegend-section').children().eq(i).children().eq(1).remove();
        if (i==5) {
            $('.accordionlegend-section').children().eq(i).css('padding-bottom', '0.7em');
        }
    }
    
    $('.leaflet-control-zoom-in').prop('title', 'Zoom In');
    $('.leaflet-control-zoom-out').prop('title', 'Zoom Out');
    
    // Turn custom controls into Leaflet controls
    //htmlControlToLeafletControl(map, 'bottomleft', 'slider-wrapper');
    htmlControlToLeafletControl(map, 'topleft', 'basemap-selector');
    htmlControlToLeafletControl(map, 'topleft', 'street-view');
}
// End of createMap()

// Set up cursor toggle and Google Street View tool
var map = $('#map');
$('#street-view').on('click', function() {
    if (map.css('cursor') == 'crosshair') {
        map.css('cursor', 'pointer');
    } else {
        map.css('cursor', 'crosshair');
    }
});

function googleStreet(e) {
    console.log("Lat, Lon : " + e.latlng.lat + ", " + e.latlng.lng);
    var url = "https://maps.google.com/maps?q=&layer=c&cbll=" + e.latlng.lat + "," + e.latlng.lng
    window.open(url);
    map.css('cursor', 'pointer');
}

// Main pipe symbology - unique categories
function pipeSymbology(feature) {
    var c;
    var o = 0.75;
    switch (feature.properties.CNG_TYPE_C) {
        case 'Storm Line':
            c = '#7532a8';
            break;
        case 'Open Ditch/Channel':
            c = '#f2950a';
            break;
    }
    return { color: c, opacity: o, weight: 5 };
}

// Pipe Inspection symbology - single value based on inspection flag field
function pipeInspectionOver3YearsSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag3) {
        case 1:
            c = '#e31a1c';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspectionUnder3YearsSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag3_1) {
        case 1:
            c = '#fd8d3c';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspectionUnder1YearSymbology(feature) {
    var c;
    switch (feature.properties.YearFlag1) {
        case 1:
            c = '#c2e699';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

function pipeInspection1MonthSymbology(feature) {
    var c;
    switch (feature.properties.MonthFlag) {
        case 1:
            c = '#238443';
            break;
        case 0:
            c = null;
            break;
    }
    return { color: c, opacity: 1, weight: 5 };
}

// Structure symbology - unique categories with picture symbols
function structureIcons(feature) {
    var icon;
    var drainIcon = L.icon({
        iconUrl: './img/drain.png',
        iconSize: [18, 18]
    });
    var mhIcon = L.icon({
        iconUrl: './img/manhole.png',
        iconSize: [18, 18]
    });
    var disIcon = L.icon({
        iconUrl: './img/discharge.png',
        iconSize: [18, 18]
    });
    if (feature.properties.SNG_TYPE_C == 'Storm Manhole') icon = mhIcon;
    else if (feature.properties.SNG_TYPE_C == 'Catch Basin') icon = drainIcon;
    else if (feature.properties.SNG_TYPE_C == 'End of Pipe') icon = disIcon;
    return icon;
}

// Format structure popup information
function strucPopup() {
    return '<h5>{SNG_TYPE_C}</h5>' +
           '<p>Structure ID: {SNG_ST_NO}<br />' +
           'Cover: {SNG_COVR_C}<br />' +
           'Rim Elevation (ft): {SNG_RIM_EL}<br />' +
           'Depth (ft): {SNG_DEPTH}</p>';
}

// Format pipe popup information
function pipePopup(insDate) {
    return '<h5>{CNG_TYPE_C}</h5>' +
           '<p>Pipe ID: {CNG_NUMBER}<br />' +
           'US Structure ID: {CNG_US_STR}<br />' +
           'DS Structure ID: {CNG_DS_STR}<br />' +
           'Material: {CNG_MATR_C}<br />' +
           'Diameter (ft): {CNG_DIA}<br />' +
           'Length (ft): {CNG_LENGTH}<br />' +
           'Owner: {CNG_OWN_CD}<br />' +
           'Inspection Date: ' + insDate + '</p>';
}

// Html element to custom Leaflet control
function htmlControlToLeafletControl(map, position, element) {
    var NewControl = L.Control.extend({
        options: {
            position: position
        },
        onAdd: function() {
            var newControl = L.DomUtil.get(element);
            return newControl;
        }
    });
    map.addControl(new NewControl());
}

// Disable pan/zoom interactions on custom controls
$('.custom-control, .legend-control-container').on('mousedown dblclick click', function(e) {
   L.DomEvent.stopPropagation(e); 
});

// Build legend object here to keep it out of createMap
function legendContent(pipes, structures, over3Years, under3Years, under1Year, under1Month) {
    var content = 
    [
        {
            'title': "Storm Infrastructure",
            layers: [
                {
                    'title': "Structures",
                    'layer': structures,
                    'legend': [
                        { 'type':'image', 'url':'img/manhole.png', 'text':"Manhole" },
                        { 'type':'image', 'url':'img/drain.png', 'text':"Catch Basin" },
                        { 'type':'image', 'url':'img/discharge.png', 'text':"End of Pipe" }
                    ]
                },
                {
                    'title': "Pipes",
                    'layer': pipes,
                    'legend': [
                        { 'type':'line', 'color':'#7532a8', 'text':"Storm Line" },
                        { 'type':'line', 'color':'#f2950a', 'text':"Open Ditch" }
                    ]
                }

            ]
        },
        {
            'title': "Pipe Inspections",
            layers: [
                {
                    'title': "Over 3 Years",
                    'layer': over3Years,
                    'legend': [
                        { 'type':'line', 'color':'#e31a1c', 'text':"" }
                    ]
                },
                {
                    'title': "Under 3 Years, Over 1 Year",
                    'layer': under3Years,
                    'legend': [
                        { 'type':'line', 'color':'#fd8d3c', 'text':"" }
                    ]
                },
                {
                    'title': "Under 1 Year, Over 1 Month",
                    'layer': under1Year,
                    'legend': [
                        { 'type':'line', 'color':'#78c679', 'text':"" }
                    ]
                },
                {
                    'title': "Within Last Month",
                    'layer': under1Month,
                    'legend': [
                        { 'type':'line', 'color':'#238443', 'text':"" }
                    ]
                }
            ]
        }
    ]
    return content;
}

$(document).tooltip();
$(document).ready(createMap);

if ($(window).width() < 799) {
    $(document).tooltip('disable');
}