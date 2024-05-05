require('dotenv').config();

const express = require("express");
const parser = require("body-parser");
const ejs = require("ejs");
const axios = require('axios');
const crypto = require("crypto");

// configuration
const OPEN_WHEATHER_API_KEY = process.env.OPEN_WHEATHER_API_KEY
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
const IP_GEOLOCATION_API_KEY = process.env.IP_GEOLOCATION_API_KEY

if (OPEN_WHEATHER_API_KEY == null) {
    console.log(JSON.stringify({
        "level": "error", "ts":new Date().getTime(), 
        "message": "failed to configure application",
        "err": "open weather api key not provided",
    }))
    process.exit(1)
}
if (UNSPLASH_ACCESS_KEY == null) {
    console.log(JSON.stringify({
        "level": "error", "ts":new Date().getTime(), 
        "message": "failed to configure application",
        "err": "unsplash api key not provided",
    }))
    process.exit(1)
}
if (IP_GEOLOCATION_API_KEY == null) {
    console.log(JSON.stringify({
        "level": "error", "ts":new Date().getTime(), 
        "message": "failed to configure application",
        "err": "ip geolocation api key not provided",
    }))
    process.exit(1)
}

// UNITS is a list of defined units in metric, imperial and standard format
const UNITS = {
    metric: {
        temperature: "C",
        wind: "m/h"
    },
    imperial:{
        temperature: "F",
        wind: "mi/h"
    },
    standard: {
        temperature: "K",
        wind: "m/h"
    },
}

// MONTHS is a list of labels for months where January is at index 0 and 
// December is at index 11.
const MONTHS = [ 
    "January",   "February", "March",    "April", 
    "May",       "June",     "July",     "August",
    "September", "October",  "November", "December"
]

// getWindDirection returns the label for the wind direction calculated from 
// and angle. 0 degree is north.
function getWindDirection(angle){
    if (angle < 23) {
        return "North"       
    } else if (angle < 68) {
        return "North East"  
    } else if (angle < 113) {
        return "East"  
    } else if (angle < 158) {
        return "South East"  
    } else if (angle < 203) {
        return "South"  
    } else if (angle < 248) {
        return "South West"  
    } else if (angle < 293) {
        return "West"  
    } else if (angle < 338) {
        return "North West"  
    } else {
        return "North"  
    }
}

// getPlaceTime returns the date and time in the format of 01:02 1st of January.
// It takes into account the timezone and the daylight saving time.
function getPlaceTime(unix, timezone, dst){
    const date = new Date();
    const offsetHours = timezone + (dst?1:0);
    date.setTime(unix * 1000 + offsetHours * 3600000);

    const day    = date.getUTCDate();
    const month  = MONTHS[date.getUTCMonth()];
    const hour   = date.getUTCHours();
    const minute = date.getUTCMinutes();

    const suffix = day % 10 == 1 ? "st"
        : day % 10 == 2 ? "nd"
        : day % 10 == 3 ? "rd"
        : "th";

    return {
        time: `${hour}:${(minute < 10 ? "0" : "") + minute}`,
        date: `${day}${suffix} of ${month}`
    }
}

const app = express();

app.set("view engine", "ejs");
app.use(parser.urlencoded({extended: true}));
app.use(express.static("public"))

app.listen(3000, ()=>{
    console.log(JSON.stringify({
        "level": "info", "ts":new Date().getTime(), 
        "message": "server started",
    }))
})

app.get("/", async (req,res)=>{
    const traceId = crypto.randomBytes(16).toString("hex");
    console.log(JSON.stringify({
        "level": "info",  "ts":new Date().getTime(), 
        "message": "creating weather card", "tid": traceId,
    }))

    const {city="London", units="metric"} = req.query;

    // get the weather information
    console.log(JSON.stringify({
        "level": "info", "ts":new Date().getTime(), 
        "message": "getting weather information",
        "tid": traceId,"city": city, "units": units,
    }))
    let weatherPromise = axios({
        method: 'get',
        url: 'https://api.openweathermap.org/data/2.5/weather',
        params: {
            "q": city,
            "units": units,
            "appid": OPEN_WHEATHER_API_KEY,
        }
    })

    // get an image of the city to display
    console.log(JSON.stringify({
        "level": "info", "ts":new Date().getTime(), 
        "message": "getting location image",
        "tid": traceId,"city": city
    }))
    let unsplashPromise = axios({
        method: 'get',
        url: 'https://api.unsplash.com/search/photos',
        params: {
            "per_page": 1,
            "orientation": "landscape",
            "query": city + " city"
        },
        headers: {
            "Authorization": "Client-ID "+ UNSPLASH_ACCESS_KEY
        }
    })

    // get date time information of the city
    console.log(JSON.stringify({
        "level": "info", "ts":new Date().getTime(), 
        "message": "getting date time info",
        "tid": traceId,"location": city
    }))
    let ipgeolocPromise = axios({
        method: 'get',
        url: 'https://api.ipgeolocation.io/timezone',
        params: {
            "apiKey": IP_GEOLOCATION_API_KEY,
            "location": city,
        }
    })

    // awaiting the weather request's response
    let weatherResponse
    try {
        weatherResponse = await weatherPromise
    } catch(err) {
        let errCode = 500
        if (err.response) {
            errCode = response.status
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to get weather information",
                "tid": traceId, "err": err.message, "status": response.status, 
                "data": response.data
            }))
        } else if (err.request) {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to make request",
                "tid": traceId, "err": err.message
            }))
        } else {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "unexpected error",
                "tid": traceId, "err": err.message, 
            }))
        }
        res.render("error.ejs", {errcode:errCode});
        return;
    }

    // awaiting the location image request's response
    let unsplashResponse 
    try {
        unsplashResponse = await unsplashPromise
    } catch(err) {
        let errCode = 500
        if (err.response) {
            errCode = response.status
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to get location image",
                "tid": traceId, "err": err.message, "status": response.status, 
                "data": response.data
            }))
        } else if (err.request) {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to make request",
                "tid": traceId, "err": err.message
            }))
        } else {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "unexpected error",
                "tid": traceId, "err": err.message, 
            }))
        }
        res.render("error.ejs", {errcode:errCode});
        return;
    }

    // awaiting the date time information request's response
    let ipgeolocResponse
    try {
        ipgeolocResponse = await ipgeolocPromise
    } catch(err) {
        let errCode = 500
        if (err.response) {
            errCode = response.status
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to get date time information",
                "tid": traceId, "err": err.message, "status": response.status, 
                "data": response.data
            }))
        } else if (err.request) {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "failed to make request",
                "tid": traceId, "err": err.message
            }))
        } else {
            console.log(JSON.stringify({
                "level": "error", "ts":new Date().getTime(), 
                "message": "unexpected error",
                "tid": traceId, "err": err.message, 
            }))
        }
        res.render("error.ejs", {errcode:errCode});
        return;
    }

    // compile results
    console.log
    try {
        const {
            date_time_unix: unix, timezone_offset: timezone, is_dst: dst
        }  = ipgeolocResponse.data;

			let options = {
				city: city,
				...getPlaceTime(unix, timezone, dst),

            weather: weatherResponse.data.weather[0].main,
            temperature: `${Math.floor(weatherResponse.data.main.temp)}°${UNITS[units].temperature}`,
            humidity: `${weatherResponse.data.main.humidity}%`,
            visibility: `${weatherResponse.data.visibility/100}%`,
            cloudiness: `${weatherResponse.data.clouds.all}%`,
            windSpeed: `${weatherResponse.data.wind.speed} ${UNITS[units].wind}`,
            windDirection: getWindDirection(weatherResponse.data.wind.deg),

            icon: weatherResponse.data.weather[0].icon,
            imageURL: unsplashResponse.data.results[0].urls.regular
        };

        console.log(JSON.stringify({
            "level": "info", "ts":new Date().getTime(), 
            "message": "request complete",
            "tid": traceId,
        }))

        res.render("weathercard.ejs", options);
    } catch(err) {
        console.log(JSON.stringify({
            "level": "error", "ts":new Date().getTime(), 
            "message": "unexpected error",
            "tid": traceId, "err": err.message, 
        }))

        res.render("error.ejs", {errcode:500});
        return;
    }
})
