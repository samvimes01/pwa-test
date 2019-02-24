// Copyright 2016 Google Inc.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//      http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
const localForage = localforage;

(function() {
  'use strict';

  var app = {
    isLoading: true,
    visibleCards: {},
    selectedCities: [],
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };


  /*****************************************************************************
   *
   * Event listeners for UI elements
   *
   ****************************************************************************/

  document.getElementById('butRefresh').addEventListener('click', function() {
    // Refresh all of the forecasts
    app.updateForecasts();
  });

  document.getElementById('butAdd').addEventListener('click', function() {
    // Open/show the add new city dialog
    app.toggleAddDialog(true);
  });

  document.getElementById('butAddCity').addEventListener('click', function() {
    // Add the newly selected city
    var select = document.getElementById('selectCityToAdd');
    var selected = select.options[select.selectedIndex];
    var key = selected.value;
    var label = selected.textContent;
    // TODO init the app.selectedCities array here
    if (!app.selectedCities) {
      app.selectedCities = [];
    }
    app.getForecast(key, label);
    // TODO push the selected city to the array and save here
    app.selectedCities.push({key: key, label: label});
    app.saveSelectedCities();
    app.toggleAddDialog(false);
  });

  document.getElementById('butAddCancel').addEventListener('click', function() {
    // Close the add new city dialog
    app.toggleAddDialog(false);
  });


  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

  // Toggles the visibility of the add new city dialog.
  app.toggleAddDialog = function(visible) {
    if (visible) {
      app.addDialog.classList.add('dialog-container--visible');
    } else {
      app.addDialog.classList.remove('dialog-container--visible');
    }
  };

  // Updates a weather card with the latest weather forecast. If the card
  // doesn't already exist, it's cloned from the template.
  app.updateForecastCard = function(data) {
    var dataLastUpdated = new Date(data.time);
    var sunrise = data.sun_rise;
    var sunset = data.sun_set;
    var current = data.consolidated_weather[0];
    var humidity = current.humidity;
    var wind = {speed: current.wind_speed, direction: current.wind_direction,};

    var card = app.visibleCards[data.key];
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.querySelector('.location').textContent = data.label;
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[data.key] = card;
    }

    // Verifies the data provide is newer than what's already visible
    // on the card, if it's not bail, if it is, continue and update the
    // time saved in the card
    var cardLastUpdatedElem = card.querySelector('.card-last-updated');
    var cardLastUpdated = cardLastUpdatedElem.textContent;
    if (cardLastUpdated) {
      cardLastUpdated = new Date(cardLastUpdated);
      // Bail if the card has more recent data then the data
      if (dataLastUpdated.getTime() < cardLastUpdated.getTime()) {
        return;
      }
    }
    cardLastUpdatedElem.textContent = data.time;

    card.querySelector('.description').textContent = current.weather_state_name;
    card.querySelector('.date').textContent = current.applicable_date;
    card.querySelector('.current .icon').classList.add(app.getIconClass(current.weather_state_abbr));
    card.querySelector('.current .temperature .value').textContent =
      Math.round(current.the_temp);
    card.querySelector('.current .sunrise').textContent = (new Date(sunrise)).toLocaleString("en-US");
    card.querySelector('.current .sunset').textContent = (new Date(sunset)).toLocaleString("en-US");
    card.querySelector('.current .humidity').textContent =
      Math.round(humidity) + '%';
    card.querySelector('.current .wind .value').textContent =
      Math.trunc(wind.speed);
    card.querySelector('.current .wind .direction').textContent = Math.trunc(wind.direction);
    var nextDays = card.querySelectorAll('.future .oneday');
    var today = new Date();
    today = today.getDay();
    for (var i = 1; i < 7; i++) {
      var nextDay = nextDays[i-1];
      var daily = data.consolidated_weather[i];
      if (daily && nextDay) {
        nextDay.querySelector('.date').textContent =
          app.daysOfWeek[(i-1 + today) % 7];
        nextDay.querySelector('.icon').classList.add(app.getIconClass(daily.weather_state_abbr));
        nextDay.querySelector('.temp-high .value').textContent =
          Math.round(daily.max_temp);
        nextDay.querySelector('.temp-low .value').textContent =
          Math.round(daily.min_temp);
      }
    }
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  };


  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

  /*
   * Gets a forecast for a specific city and updates the card with the data.
   * getForecast() first checks if the weather data is in the cache. If so,
   * then it gets that data and populates the card with the cached data.
   * Then, getForecast() goes to the network for fresh data. If the network
   * request goes through, then the card gets updated a second time with the
   * freshest data.
   */
  app.getForecast = function(key, label) {
    app.updateForecastCard(initialWeatherForecast);

    var url = 'https://www.metaweather.com/api/location/' + key;
    // TODO add cache logic here
    if ('caches' in window) {
      /*
       * Check if the service worker has already cached this city's weather
       * data. If the service worker has the data, then display the cached
       * data while the app fetches the latest data.
       */
      caches.match(url).then((response) => {
        if (response) {
          response.json().then((result) => {
            result.key = key;
            result.label = label;
            app.updateForecastCard(result);
          });
        }
      });
    }

    // Fetch the latest data.
    fetch(url)
      .then((response) => {
        return response.json();
      })
      .then((result) => {
        result.key = key;
        result.label = label;
        app.updateForecastCard(result);
      })
      .catch(() => app.updateForecastCard(initialWeatherForecast));
  };

  // Iterate all of the cards and attempt to get the latest forecast data
  app.updateForecasts = function() {
    var keys = Object.keys(app.visibleCards);
    keys.forEach(function(key) {
      app.getForecast(key);
    });
  };

    // Save list of cities to localStorage.
    app.saveSelectedCities = function() {
      var selectedCities = JSON.stringify(app.selectedCities);
      // localStorage.selectedCities = selectedCities;
      localForage.setItem('selectedCities', selectedCities);
    };

  app.getIconClass = function(weatherCode) {
    // Weather codes: https://developer.yahoo.com/weather/documentation.html#codes
    // weatherCode = parseInt(weatherCode);
    switch (weatherCode) {
      case 'c': // sunny
        return 'clear-day';
      case 's': // freezing rain
      case 'lr': // showers
      case 'hr': // showers
      case 'h': // hail
        return 'rain';
      case 't':
        return 'thunderstorms';
      case 'sl':
      case 'sn':
        return 'snow';
      case 'hc': // mostly cloudy
        return 'cloudy';
      case 'lc': // cloudy
        return 'partly-cloudy-day';
    }
  };

  /*
   * Fake weather data that is presented when the user first uses the app,
   * or when the user has not saved any cities. See startup code for more
   * discussion.
   */
  var initialWeatherForecast = {
    key: '2459115',
    label: 'New York, NY',
    created: '2016-07-22T01:00:00Z',
    sun_rise: "5:43 am",
    sun_set: "8:21 pm",
    consolidated_weather: [
      {
        humidity: 56,
        wind_speed: 25,
        wind_direction: 195,
        weather_state_name: "Windy",
        weather_state_abbr: 'c',
        applicable_date: "Thu, 21 Jul 2016 09:00 PM EDT",
        the_temp: 56,
        max_temp: 66,
        min_temp: 46,
      },
      {weather_state_abbr: 'c', max_temp: 86, min_temp: 70,},
      {weather_state_abbr: 's', max_temp: 94, min_temp: 73,},
      {weather_state_abbr: 'lr', max_temp: 95, min_temp: 78,},
      {weather_state_abbr: 'hr', max_temp: 75, min_temp: 89,},
      {weather_state_abbr: 'h', max_temp: 89, min_temp: 77,},
    ]
  };

  // TODO uncomment line below to test app with fake data
  // app.updateForecastCard(initialWeatherForecast);

  /************************************************************************
   *
   * Code required to start the app
   *
   * NOTE: To simplify this codelab, we've used localStorage.
   *   localStorage is a synchronous API and has serious performance
   *   implications. It should not be used in production applications!
   *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
   *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
   ************************************************************************/

  // app.selectedCities = localStorage.selectedCities;
  localForage.getItem('selectedCities')
  .then((data) => {
    if (data) {
      app.selectedCities = JSON.parse(data);
      app.selectedCities.forEach(function(city) {
        app.getForecast(city.key, city.label);
      });
    } else {
      /* The user is using the app for the first time, or the user has not
       * saved any cities, so show the user some fake data. A real app in this
       * scenario could guess the user's location via IP lookup and then inject
       * that data into the page.
       */
      app.updateForecastCard(initialWeatherForecast);
      app.selectedCities = [
        {key: initialWeatherForecast.key, label: initialWeatherForecast.label}
      ];
      app.saveSelectedCities();
    }
  });
  
  // TODO add service worker code here
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('./service-worker.js')
             .then(function() { console.log('Service Worker Registered'); });
  }
})();
