# Seasonal Fire Forecasting - Colombian Amazon

This repository contains the scripts used to create a seasonal fire prediction model for the Colombian Amazon for the January-March 2023 season using Google Earth Engine and other tools used primarily for the preparation of the input variables, such as R statistical software and QGIS. The occurrence of fire in the Colombian Amazon is highly seasonal, and the season of greatest fire across most of the region is centered on January-March, during the driest part of the year.  The prediction model is based upon the maximum entropy (Maxent) method, which produces a gridded field of probabilities of fire occurrence based upon observed climate and forest loss conditions in October-December 2022 applied to a model trained using observed climate and forest loss conditions in October-December 2021 and fire occurrence in January-March 2022.

## Inputs

### Training Predictand Variable: VIIRS Suomi-NPP 375-meter resolution active fires data set
 
The training predictand variable in this model is a field of 0.25° lat/lon resolution grid boxes in the Colombian Amazon containing a value of either 1 or 0 for the January-March 2022 season, specifying whether the grid box for that season contains a count of active fires within the upper one-third of the January-March 2012 to 2022 historical distribution of active fire counts for that grid box (1 for true, and 0 for false).  In other words, a value of 1 for a given grid box indicates that the number of active fires found within that grid box during the January-March 2022 fire season was high (in the upper tercile) compared to other January-March seasons from 2012 to 2022.  The presence (1) or absence (0) of large numbers of fires in a pixel is used as the predictand (rather than the number of fires, for example) because the maximum entropy technique is based upon modeling the spatial distribution of the presence of the variable of interest (species, fires, etc.), not quantities.

### Training Predictor Variables, October-December 2021

#### ERA5 Single-Level Monthly Average Variables

The spatial resolution of the ERA5 Single-Level Monthly Average data is 0.25° lat/lon, and the data are released approximately five days after the end of each month, allowing the data to be used in near real-time predictions.  Data files for these monthly data are downloaded from the following page in the Copernicus Climate Data Store.

Variables downloaded:
- Total precipitation (m)
- 2m temperature (K)
- Volumetric soil water layer 1 (m3/m3; 0-7 cm in depth)

The variables representing conditions in the October-December 2021 season used for training needed to match variables that would be available for download in near real-time from the October-December 2022 season.

#### ERA5 Single-Level Hourly Variables

The 2-meter temperature and 2-meter dew point temperature variables from the ERA5 Single-Level Hourly data set are used to calculate vapor pressure deficit (VPD) on an hourly basis from the beginning of October to the end of December using the approximation for calculating vapor pressure described in Alduchov and Eskridge (1996), and is then averaged over that period to calculate seasonal-average VPD values.

#### Forest Loss Variable

Deforestation in the Colombian Amazon has been found to be strongly associated with the location and extent of fires in the region (Armenteras and Retana 2012; Armenteras et al. 2013).  In this model, the University of Maryland Global Land Analysis and Discovery (GLAD) Forest Loss Alerts (Hansen et al. 2016) have been used to quantify forest loss in the Colombian Amazon in October-December seasons as a predictor for fires in the following January-March season.  In the Hansen et al. (2016) data set, a forest loss alert is indicated for a 30-meter spatial resolution Landsat pixel in which more than 50% of forest canopy cover has been removed, where forest cover is defined as trees at least 5-meters in height with canopy closure greater than 30%.  Since 2021, the GLAD Alert data have been based upon Landsat Collection 2 data.
We restrict the domain to the Colombian Amazon, isolate the forest loss alerts for the October-December season, and return forest loss alert counts for the coarser 0.25° lat/lon grid that matches the gridding of the ERA5 climate data.

#### Protected Areas

We used the Protected Areas data available from The United Nations Environment Programme World Conservation Monitoring Centre (UNEP-WCMC) and the International Union for Conservation of Nature (IUCN), the World Database on Protected Areas (WDPA). We produced a raster grid of the fraction of the area within each ERA5 0.25° grid box in the Colombian Amazon that contains protected areas.

## Maxent Model in Google Earth Engine

A number of arguments are available in the Maxent classifier in Google Earth Engine, including, among others, the names of any categorical variables (not used in this case), the type of function used to represent the final output probabilities of the model (the default “cloglog” is used here), and whether or not to allow the classifier to automatically choose the types of features (basis functions) to use.  In our case, we set this to false and specified them ourselves.  Linear, quadratic, and product features were used in the model, but threshold and hinge features were not.  All other arguments in the Maxent classifier were allowed to take their default values.

The environment variables from the October-December 2021 season and the observed upper-tercile active fire occurrences from January-March 2022 are used to train the model. The environment variables from the October-December 2022 season are used to make the prediction. Randomly-generated fire pseudo-absence points for January-March 2022 spaced at least 25-km apart in the Colombian Amazon are used as absence points whereas the VIIRS data from January-March 2022 are used as presence data.

## Workflow

![](/images/workflow.jpg "Workflow")

## App

The gridded field of predicted upper-tercile file probabilities for the January-March 2023 season for the Colombian Amazon was featured in a publicly-available interactive Earth Engine App named “Aptitud para incendios: Enero-Marzo 2023” which can be accessed through the link: [https://servir-amazonia.earthengine.app/view/aptitud-incendios](https://servir-amazonia.earthengine.app/view/aptitud-incendios).

NextGen results for DJF 2024: [https://retsalp.users.earthengine.app/view/colamazon-fire-prediction-2024](https://retsalp.users.earthengine.app/view/colamazon-fire-prediction-2024)

![](/images/era5app.png "JFM 2023 forecast using ERA5 data")

![](/images/nextgenapp.png "JFM 2023 forecast using ERA5 data")

## Evaluation

Given that the prediction is given in a probabilistic form, a quantitative way to evaluate the prediction is through an analysis of the receiver operating characteristic curve (ROC) associated with the prediction and the corresponding verification data set, specifically the area under the curve (AUC). 

## Additional information

- We have been testing the model with NextGen data, rather than ERA5 data.
- More information about the Methodology and the Evaluation can be found in the following slides:
    - [ERA5 (EN)](https://docs.google.com/presentation/d/1ya0w3Bfp5ALAKXSVZvNanjxZqKV8cKyj/edit)
    - [ERA5 (ES)](https://docs.google.com/presentation/d/1CFQ-vf748dZwFzsjDE8O_t54ftfjZm1n/edit)
    - [NextGen (EN)](https://docs.google.com/presentation/d/1szP6z4tIs4cWkSg6z5whYZYmV7TP9f_a/edit)
    - [NextGen (ES)](https://docs.google.com/presentation/d/1fDjp7YXcGFO65K0TTa76IUxlvYr4fG5S/edit)

