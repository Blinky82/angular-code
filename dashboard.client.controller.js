'use strict';

// Articles controller
angular.module('dashboard').controller('DashboardController', ['$scope', '$q', '$state', '$stateParams', '$location', '$filter', 'Authentication',
         'LocationTypes', 'Request', 'NgTableParams', 'CacheService', 'SystemMessages', 'rackUtils',
	function($scope, $q, $state, $stateParams, $location, $filter, Authentication, LocationTypes, Request,
			 NgTableParams, CacheService, SystemMessages, rackUtils) {
		$scope.authentication = Authentication;
        if (!$scope.authentication.user) {
            $location.path('/');
            return false;
        }

		$scope.cacheService = CacheService;

		$scope.dashboardFilter = ($scope.cacheService.dashboardFilter)?$scope.cacheService.dashboardFilter:{};
		$scope.activeFilter = ($scope.cacheService.dashboardActiveFilter)?$scope.cacheService.dashboardActiveFilter:false;

		$scope.dashboardActiveTab = $scope.cacheService.dashboardActiveTab;

		var deferredGetAllCountriesStatistics = $q.defer();
		var deferredGetAllRacks = $q.defer();
		var deferredGetLastAddedDevices = $q.defer();
		var deferredGetAllLocationsWithStatistics = $q.defer();

		var promises = [deferredGetAllCountriesStatistics.promise, deferredGetAllRacks.promise, deferredGetLastAddedDevices.promise, deferredGetAllLocationsWithStatistics.promise];

        $scope.countries = [];
        $scope.countriesOut = { values: [] };
        $scope.cities = [];
        $scope.citiesOut = { values: [] };
        $scope.locationTypes = angular.copy(LocationTypes);
        $scope.locationTypesOut = { values: [] };

		$scope.locationTypes.forEach(function (locationType) {

			if($scope.dashboardFilter.type && $scope.dashboardFilter.type.indexOf(locationType.name) > -1) {
				locationType.ticked = true;
			}
			else {
				locationType.ticked = false;
			}
		});

		$scope.dashboardActiveTabChanged = function (tabNumber) {
			$scope.dashboardActiveTab = tabNumber;
			$scope.cacheService.dashboardActiveTab = tabNumber;
		};

		var tableFilterDataWithPaging = function (type, data, params) {

			var sorting = params.sorting();
			var sortingKeys = Object.keys(sorting);

			var filteredData = angular.copy(data);

			if(type === 'LastCreatedRack') {
				filteredData = $filter('orderBy')(data, 'createdAt', true);
			}

			if(sortingKeys.length > 0) {
				filteredData = $filter('orderBy')(data, sortingKeys[0],(sorting[sortingKeys[0]]=='desc'));
			}

			if(Object.keys(params.filter()).length > 0) {
				filteredData = $filter('filterDashboard')(type, filteredData, params.filter());
			}

			var result = [];
			if(type === 'LastCreatedRack') {
				result = filteredData.slice(0,10);
			}
			else {
				result = filteredData.slice((params.page() -1) * params.count(),params.page() * params.count());
			}

			return result;
		};

		Request['GetAllCountriesStatistics'].query().$promise.then( function (data) {
        	$scope.countryStatistics = data;
        	$scope.statisticsTableParams = new NgTableParams({
				  count: 10,
				  page: 1
	      	},{
	      		  total: data.length,
					  getData: function ($defer, params) {
				  			$defer.resolve(tableFilterDataWithPaging('CountryStatistics', data, params));
					  }

	      	});
			deferredGetAllCountriesStatistics.resolve();
        },function (error) { SystemMessages.showToasterMessage() });

		$scope.lastAddedDevices = new NgTableParams({
			count: 10,
			page: 1
		},{
			total: 0,
			counts:[],
			getData: function ($defer, params) {
				Request['GetLastAddedDevices'].getWithParams(params.filter()).$promise.then(function (data) {
					var lastAddedDevicesData = data;
					$defer.resolve(lastAddedDevicesData);
					deferredGetLastAddedDevices.resolve();
				},function (error) { SystemMessages.showToasterMessage() });
			}
		});

        Request['GetAllRacks'].query({}).$promise.then(function (data) {
        	$scope.availableRacks = data;
			$scope.availableRacks.forEach (function (rack) {
				if($scope.authentication.user.favourites.indexOf(rack.id) > -1) {
					rack.rackIsInFav = true;
				}
			});

			$scope.lastCreatedRacksTableParams = new NgTableParams({
				count: 10,
				page: 1
			},{
				total: 0,
				counts:[],
				getData: function ($defer, params) {
					$defer.resolve(tableFilterDataWithPaging('LastCreatedRack', $scope.availableRacks, params));
				}
			});

        	$scope.rackTableParams = new NgTableParams({
				  count: 10,
				  page: 1
        	},{
        		  total: data.length,
				  getData: function ($defer, params) {
					  $defer.resolve(tableFilterDataWithPaging('Rack', data, params));
				  }

        	});

			$scope.favRacks = $scope.availableRacks.filter(function (value) {
				return $scope.authentication.user.favourites.indexOf(value.id) > -1
			});

			$scope.favRackTableParams = new NgTableParams({
				count: 10,
				page: 1
			},{
				total: $scope.favRacks.length,
				getData: function ($defer, params) {
					$defer.resolve(tableFilterDataWithPaging('Rack', $scope.favRacks, params));
				}

			});
			deferredGetAllRacks.resolve();
		},function (error) { SystemMessages.showToasterMessage() });

        Request['GetAllLocationsWithStatistics'].query().$promise.then(function (data) {
        	$scope.availableLocations = data;
        	$scope.availableLocations.forEach(function (dataLocation) {
        		var selectedCountries = $scope.countries.filter(function (value) {
        			return value.name === dataLocation.country.name;
        		});

        		if(selectedCountries.length === 0) {
        			var item = { name: dataLocation.country.name, ticked: false };
        			if($scope.dashboardFilter.countryName && $scope.dashboardFilter.countryName.indexOf(item.name) > -1) {
						item.ticked = true;
					}
        			$scope.countries.push(item);
        		}
				else {
					if($scope.dashboardFilter.countryName && $scope.dashboardFilter.countryName.indexOf(selectedCountries[0].name) > -1) {
						selectedCountries[0].ticked = true;
					}
					else {
						selectedCountries[0].ticked = false;
					}
				}

        		var selectedCities = $scope.cities.filter(function (value) {
        			return value.name === dataLocation.city.name;
        		});

        		if(selectedCities.length === 0) {
					var item = { name: dataLocation.city.name, ticked: false };
					if($scope.dashboardFilter.cityName && $scope.dashboardFilter.cityName.indexOf(item.name) > -1) {
						item.ticked = true;
					}
        			$scope.cities.push(item);
        		}
        		else {
					if($scope.dashboardFilter.cityName && $scope.dashboardFilter.cityName.indexOf(selectedCities[0].name) > -1) {
						selectedCities[0].ticked = true;
					}
					else {
						selectedCities[0].ticked = false;
					}
				}
        	});

        	$scope.dataLocationTableParams = new NgTableParams({
				  count: 10,
				  page: 1
        	},{
        		  total: data.length,
				  getData: function ($defer, params) {
					  $defer.resolve(tableFilterDataWithPaging('DataLocation', data, params));
				  }
        	});

			deferredGetAllLocationsWithStatistics.resolve();
        },function (error) { SystemMessages.showToasterMessage() });

		$scope.favouritesRack = function (rack, $event) {
			$event.stopPropagation();
			rackUtils.favouritesRack($scope.authentication.user, rack).then(function (res) {
				rack.rackIsInFav = res;
				if(rack.rackIsInFav) {
					$scope.favRacks.push(rack);
				}
				else {
					$scope.favRacks.splice($scope.favRacks.indexOf(rack), 1 );
				}
				$scope.favRackTableParams.reload();
			});
		};

		function reloadTables (filter) {

			$scope.statisticsTableParams.filter(filter);
			$scope.dataLocationTableParams.filter(filter);
			$scope.rackTableParams.filter(filter);
			$scope.lastCreatedRacksTableParams.filter(filter);
			$scope.favRackTableParams.filter(filter);
			$scope.lastAddedDevices.filter(filter);

			$scope.statisticsTableParams.reload();
			$scope.rackTableParams.reload();
			$scope.dataLocationTableParams.reload();
			$scope.lastCreatedRacksTableParams.reload();
			$scope.favRackTableParams.reload();
			$scope.lastAddedDevices.reload();
		}

		$q.all(promises).then(function (data) {
			reloadTables ($scope.dashboardFilter);
		});

        $scope.itemClick = function(itemType) {
        	var countryNames = [];
        	$scope.countriesOut.values.forEach(function (value) {
        		countryNames.push(value.name);
        	});

        	var cityNames = [];
        	$scope.citiesOut.values.forEach(function (value) {
        		cityNames.push(value.name);
        	});

        	var locationTypes = [];
        	$scope.locationTypesOut.values.forEach(function (value) {
        		locationTypes.push(value.name);
        	});

        	if(countryNames.length > 0 || locationTypes.length > 0 || cityNames.length > 0) {
        		$scope.activeFilter = true;
        	}

        	var filter = {
            		countryName: countryNames,
            		cityName: cityNames,
            		type: locationTypes
            };

        	if(countryNames.length ===0 && cityNames.length  ===0 && locationTypes.length ===0 ) {
				$scope.activeFilter = false;
			}

			$scope.cacheService.dashboardFilter = filter;
			$scope.cacheService.dashboardActiveFilter = $scope.activeFilter;

			reloadTables(filter);
        };

        $scope.resetFilter = function () {
			$scope.activeFilter = false;

			$scope.countries.forEach(function (value) {
				value.ticked = false;
			});

			$scope.cities.forEach(function (value) {
				value.ticked = false;
			});

			$scope.locationTypes.forEach(function (value) {
				value.ticked = false;
			});
			$scope.cacheService.dashboardFilter = {};
			$scope.cacheService.dashboardActiveFilter = $scope.activeFilter;
			reloadTables({});
		};

        $scope.viewRack = function (element) {
			$state.go('/dashboard/viewRack.units', { rackId: (element.rackId)?element.rackId:element.id, isSaved: 0 });
        };

        $scope.viewDataLocation = function (location) {
        	$state.go('/dashboard/viewDataLocation', { dataLocationId: location.id });
        };

		$scope.viewCountry = function (country) {
			//console.log(country);
			$state.go('/dashboard/viewCountry', { countryId: country.countryId });
		};
	}
]);
