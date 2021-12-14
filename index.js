require('dotenv').config()
const express = require("express");
const parser = require("body-parser");
const ejs = require("ejs");
const https = require("https");

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

const MONTHS = [ 
    "January",   "February", "March",    "April", 
    "May",       "June",     "July",     "August",
    "September", "October",  "November", "December"
]

function getWindDirection(angle){
    
    directions = [];

    if(angle > 281 || angle < 79) {directions.push("North");}
    else if(angle < 259 && angle > 101) {directions.push("South");}

    if(angle > 349 && angle < 191) {directions.push("West");}
    else if(angle < 11 && angle > 169) {directions.push("East");}

    return directions.join(" ");
}

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

function request(url){
    return new Promise((resolve, reject) =>{
        https.get(url, (res) => {

            let packets = [];

            res.on("data", (data)=>{
                packets.push(data);
            })

            res.on("end", ()=>{
                resolve(packets);
            })

            res.on('error', (err)=>{
                reject(err);
                console.log("Hello");
            });
        });
    });
}



const app = express();

app.set("view engine", "ejs");
app.use(parser.urlencoded({extended: true}));
app.use(express.static("public"))

app.listen(3000, ()=>{
    console.log("Hello");
})

app.get("/", (req,res)=>{
    const {city="London", units="metric"} = req.query;

    const weatherURL = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${process.env.OPENWHEATHERAPIKEY}`;
    const unsplashURL = `https://api.unsplash.com/search/photos?per_page=1&client_id=${process.env.UNSPLASHAPIKEY}&orientation=landscape&query=${city}%20city`;
    const ipgeolocURL = `https://api.ipgeolocation.io/timezone?apiKey=${process.env.IPGEOLOCATIONAPIKEY}&location=${city}`;

    let weatherPromise = request(weatherURL);
    let unsplashPromise = request(unsplashURL);
    let ipgeolocPromise = request(ipgeolocURL);

    Promise.all([weatherPromise, unsplashPromise, ipgeolocPromise]).then((values)=>{
        const [weatherPackets, unsplashPackets, ipgeolocPackets] = values;

        const weatherData = JSON.parse(weatherPackets[0]);
        const unsplashData = JSON.parse(Buffer.concat(unsplashPackets));
        const ipgeolocData = JSON.parse(ipgeolocPackets[0]);

        const {
            date_time_unix: unix, 
            timezone_offset: timezone, 
            is_dst: dst
        }  = ipgeolocData;

        if(weatherData.cod != 200){
            res.render("error.ejs", {errcode:weatherData.cod});
            return;
        }

        let options = {
            city: city,
            ...getPlaceTime(unix, timezone, dst),

            weather: weatherData.weather[0].main,
            temperature: `${Math.floor(weatherData.main.temp)}°${UNITS[units].temperature}`,
            humidity: `${weatherData.main.humidity}%`,
            visibility: `${weatherData.visibility/100}%`,
            cloudiness: `${weatherData.clouds.all}%`,
            windSpeed: `${weatherData.wind.speed} ${UNITS[units].wind}`,
            windDirection: getWindDirection(weatherData.wind.deg),

            icon: weatherData.weather[0].icon,
            imageURL: unsplashData.results[0].urls.regular
        };

        res.render("weathercard.ejs", options);
    })
})