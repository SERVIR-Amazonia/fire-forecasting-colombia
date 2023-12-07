// -------------------------------------------------------------------------------
// SERVIR-Amazonia - Fire Forecasting in the Colombian Amazon JFM 2023
// Authors: Michael Bell (University of Arkansas)
//          Andréa Puzzi Nicolau (Spatial Informatics Group)
// Description: Script to train MaxEnt model using 2021 OND GLAD Alerts,
//              Protected Areas, and JFM 2022 NextGen precipitation 
//              forecast predictors and 2022 JFM predictands and apply it 
//              to 2022 OND GLAD Alerts, Protected Areas, and JFM 2023
//              NextGen precipitation forecast predictors for 2023 JFM 
//              fire forecast.
// -------------------------------------------------------------------------------

// ------- Input Variables ------------

// OND2021 GLAD Alert, PA, JFM2022 PRCP Fcst Environmental Variables Predictors.
var PRfcst22 = ee.Image("users/retsalp/NextGen/NextGenCOL_Fcst_prcp_ColAmazon_S01Dec2021_L2p5_JFM2022").select(["b1"]).rename("PRfcst");
var PA = ee.Image("users/retsalp/NextGen/Percentage_ProtectedAreas_NextGen_0p1deg_ColombianAmazon").select(["b1"]).rename("PA");
var GLAD21 = ee.Image("users/retsalp/NextGen/GLAD_Alert_Col2_Count_OND2021_NextGen_0p1deg_ColAmazon").select(["b1"]).rename("GLAD");

// Create a new image with all the bands.
var newBands22 = ee.Image([PRfcst22, PA, GLAD21]);

// OND2022 GLAD Alert, PA, JFM2023 PRCP Fcst Environmental Variables Predictors.
var PRfcst23 = ee.Image("users/retsalp/NextGen/NextGenCOL_Fcst_prcp_ColAmazon_S01Dec2022_L2p5_JFM2023").select(['b1']).rename('PRfcst');
var PA = ee.Image("users/retsalp/NextGen/Percentage_ProtectedAreas_NextGen_0p1deg_ColombianAmazon").select(["b1"]).rename("PA");
var GLAD22 = ee.Image("users/retsalp/NextGen/GLAD_Alert_Col2_Count_OND2022_NextGen_0p1deg_ColAmazon").select(["b1"]).rename("GLAD");

// Create a new image with all the bands.
var newBands23 = ee.Image([PRfcst23, PA, GLAD22]);

// ------- AOI ------------

var geom = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level0").filter(ee.Filter.eq('ADM0_NAME', 'Colombia')).geometry();
Map.centerObject(geom, 6);

// ------- Training data ------------

// 2022 Predictands, fire presence data.
var presenceData = ee.FeatureCollection('users/retsalp/NextGen/VIIRS_Suomi_Occurrences_JFM2022_NextGen_0p1deg_ColAmazon_upperflag_12_22thresh_presenceonly_GEE')

// Check the number of points
print('Number of presence points', presenceData.size());

// Get the projection of predictors image to then create absence points.
var proj = newBands22.projection();

// Create grid using the image's projection to then sample absence points at pixel centroids.
var displayGrid = function(proj) {
  // Scale by 2 because we have 2 zero crossings when using round.
  var cells = ee.Image.pixelCoordinates(proj.scale(2,2));
  return cells.subtract(cells.round()).zeroCrossing().reduce('sum').selfMask();
}; 

// Sample points from pixel centroids (500 points).
var absenceData = newBands22.select('PRfcst').addBands(ee.Image.pixelLonLat())
  .sample({
    region: geom,
    projection: proj,
    numPixels: 500,
    tileScale: 8,
    seed: 7
  });

// Create absence data from sampled points.
absenceData = absenceData.map(function(f) {
  return f.setGeometry(ee.Geometry.Point([f.getNumber('longitude'), f.getNumber('latitude')]))
          .set('presence', 0);
});
print('Number of absence points', absenceData.size());

Map.setOptions('SATELLITE');
Map.addLayer(GLAD21, null, 'GLAD22', false);
Map.addLayer(PRfcst23, null, 'PRfcst23', false);
Map.addLayer(GLAD22, null, 'GLAD21', false);
Map.addLayer(PRfcst22, null, 'PRfcst22', false);
Map.addLayer(PA, null, 'PA', false);


// To avoid sampling points at same location
// as presence data, use a spatial filter 
var distFilter = ee.Filter.withinDistance({
    distance: 10000,
    leftField: '.geo',
    rightField: '.geo',
    maxError: 10
});

var join = ee.Join.inverted();

var absenceData = join.apply(absenceData, presenceData, distFilter);
print('Number of absence points after join', absenceData.size());

// Create training points (presence+absence).
var trainingData = presenceData.merge(absenceData);
print('Total number of training points', trainingData.size());

Map.addLayer(
    trainingData.filter(ee.Filter.eq('presence', 1)), {color: 'yellow'},
    'Fire presence locations JFM 2022', false);

Map.addLayer(
    trainingData.filter(ee.Filter.eq('presence', 0)), {color: 'bc8f8f'},
    'Fire absence - randomly generated', false);

// Add predictors information to the training points.
var training = newBands22.sampleRegions(
  {collection: trainingData,
    properties: ['presence']
  });

// ------- MaxEnt Model ------------

// Define predictionBands.
var predictionBands = ["PRfcst", "PA", "GLAD"];

// Define and train the classifier using the 2021 OND GLAD Alert,
// PA, and 2022 JFM PRCP Fcst predictors.
var classifier = ee.Classifier.amnhMaxent({autoFeature: false, linear: true,
product: false, quadratic: false, threshold: false, hinge: true}).train({
  features: training,
  classProperty: 'presence',
  inputProperties: predictionBands,
});

// Print the classifier to get a sense of most important variables.
print('Classifier Explained', classifier.explain());

// Apply model to 2022 OND GLAD Alert, PA, and 2023 JFM PRCP Fcst predictors.
var imageClassified = newBands23.classify(classifier);

// ------- Resulting prediction ------------

// Get cold colors to warm colors pallete.
var palettes = require('users/gena/packages:palettes');
var palette = palettes.colorbrewer.Spectral[11].reverse();
var vis = {bands: 'probability', min: 0, max: 1, palette: palette};
// 5e4fa2,3288bd,66c2a5,abdda4,e6f598,ffffbf,fee08b,fdae61,f46d43,d53e4f,9e0142

// Add probability layer to the map.
Map.addLayer(
    imageClassified, vis, 'Probability', true);

// position legend in map frame
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 16px'
  }
});
 
// Legend title, with attributes and positioning
var legendTitle = ui.Label({
  value: 'Probability',
  style: {
    fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }
});
 
// Add the legend title to the legend panel
legend.add(legendTitle);
 
// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }
      });
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      });
};
 
//  Color palette for legend
var palette =['5e4fa2','3288bd','66c2a5','abdda4','e6f598','ffffbf','fee08b','fdae61','f46d43','d53e4f','9e0142'];
//5e4fa2,3288bd,66c2a5,abdda4,e6f598,ffffbf,fee08b,fdae61,f46d43,d53e4f,9e0142
 
// legend labels
var names = ['0.','','','','','0.5','','','','','1.'];
 
// Add each color and associated label
for (var i = 0; i < 11; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 
// Add the legend to the map
Map.add(legend);
 
// Define boundary box to specify a box around southern Colombia, using
// degrees lat/lon, and name box "bBox2"

var bBox2 = ee.Geometry.BBox(-78.175, -5.0, -65.875, 5.4);

// Export the fire probability image for the Colombian Amazon to your
// Google Drive as a GeoTIFF file

Export.image.toDrive({
  image: imageClassified,
  description: 'Fire_suit_prob_JFM2023_NextGen_PRfcst_PA_GLAD_MaxEnt_train_envJFM22OND21_fireJFM22_fcst_envJFM23OND22_LH',
  region: bBox2,
  crs: 'EPSG:4326',
  dimensions: "123 x 104",
  fileFormat: 'GeoTIFF'
});
