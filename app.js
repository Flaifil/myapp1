'use strict';
//Framework express
var express = require('express');
var app = express();

var path = require('path'); //Lire les fichier html

// enregistrement formulaire
var bodyParser = require('body-parser'); 
app.use(bodyParser.urlencoded({ extended: false }));

//Mode API, pour que REACT récupere les données
var cors = require('cors');
app.use(cors({credentials:true, origin:'http://localhost:3000'}));

const bcrypt = require('bcryptjs');//Encodage des mot de passe

//hpp
// const hpp = require('hpp');
// app.use(hpp)

// nocache
const nocache = require('nocache');
app.use(nocache());

//Method PUT et DELETE dans le front
const methodOverride = require('method-override');
app.use(methodOverride('_method'))

//Systeme de vue : EJS
app.set('view engine', 'ejs');

//Utilisation des cookies :
const cookieParser = require('cookie-parser');
app.use(cookieParser());

//Import JWT
const {createTokens, validateToken} = require('./JWT');

//BDD
require('dotenv').config();
var mongoose = require('mongoose');
const url = process.env.DATABASE_URL;

mongoose.connect(url, {
    useNewUrlParser : true,
    useUnifiedTopology: true
}).then(console.log('MongoDB connected'))
.catch(err => console.log(err))


//Appelles des modèles
var Form = require('./modeles/Formulaire');

const User = require('./modeles/User');

const Blog = require('./modeles/Blog');

//toobusy = beaucoup de connexion

const toobusy = require('toobusy-js');

app.use(function(req,res,next){
    if(toobusy()){
        res.status(503).send("Server too busy");
    }
    else{
        next();
    }
});

const session = require('express-session');
const svgCaptcha = require('svg-captcha');

app.use(
    session({
        secret : 'my-secret-key',
        resave:false,
        saveUnitialised:true

    })
)
// routes captcha

app.get('/captcha',function(req,res,next){
    const captcha = svgCaptcha.create({
        size: 5,
        noise: 5
});
    req.session.captcha = captcha.text;
    res.type('svg');
    res.status(200).send(captcha.data);
})
app.post('/verifycaptcha', function(req,res,next){
    const {userInput} = req.body;
    if(userInput === req.session.captcha) {
        res.status(200).send('Captcha valid !')

    } 
    else{
        res.status(400).send('Captcha invalid !');
    }
});

const multer = require('multer')
app.use(express.static('uploads'))

const storage = multer.diskStorage({
    
    destination: (req, file, cb)=>{
        cb(null, 'uploads/');
    },
    filename: (req, file, cb)=>{
        cb(null, file.originalname);
    }
})
const upload = multer({storage})

app.post('/upload', upload.single('image'), (req, res) =>{
    if(!req.file){
        res.status(400).send('No File uploaded');
    }
    else{
        res.send('File uploaded successfully')
    }
})

app.post('/multipleImages', upload.array('images', 5), (req, res) =>{
    if(!req.files || req.files.length === 0){
        res.status(400).send('No File uploaded');
    }
    else{
        res.send('File uploaded successfully')
    }
})

app.post('/submit-blog',upload.single('image'), function(req, res) {
    const Data = new Blog({
        titre : req.body.titre,
        username : req.body.username,
        imageName: req.body.imageName,
        article: req.body.article,
    });

    Data.save().then(() =>{
        res.send('File and Data uploaded successfully')
    }).catch(err => console.log(err));
})

app.get('/myblog', function (req, res) {
    Blog.find().then((data) => {
        res.json(data);
    });
});



app.get("/", function(req, res) {
    res.sendFile(path.resolve('formulaire.html'));
})

// CONTACT ROUTES
app.post("/submit-data", function(req, res) {
    console.log(req.body);
    var name = req.body.prenom + ' ' + req.body.nom;

    res.send(name + ' Submitted Successfully !')
});

app.get("/contact", function(req, res) {
    res.sendFile(path.resolve('contact.html'));
});

// app.post("/submit-contact", function(req, res) {
//     var retour = "Bonjour " + req.body.nom + " " + req.body.prenom + "<br>Merci de nous avoir contacté";
//     var email = req.body.email;
//     res.send(retour + "<br>Nous reviendrons vers vous dans les plus brefs délai " + email);
// });

app.post("/submit-contact", function(req, res) {
    const Data = new Form({
        prenom : req.body.prenom,
        nom : req.body.nom,
        email: req.body.email,
        tel: req.body.tel,
        message: req.body.message
    });
    Data.save().then(() =>{
        res.redirect('/')
    }).catch(err => console.log(err));
});

app.get('/', function(req, res) {
    Form.find().then(data => {
        console.log(data);
        res.render('Home', {data: data})
    })
});


app.get('/contact/:id', function(req, res) {

    Form.findOne({
        _id: req.params.id
    }).then(data => {
        res.render("Edit", {data: data})
    }).catch(err => {console.log(err)});
});

app.put('/contact/edit/:id', function (req, res) {
    const Data = {
        prenom : req.body.prenom,
        nom : req.body.nom,
        email: req.body.email,
        tel: req.body.tel,
        message: req.body.message
    };

    Form.updateOne({_id: req.params.id}, {$set: Data})
    .then((result) => {
        console.log(result);
        res.redirect('/')
    }).catch((err) => {
        console.log(err);
    });
})

app.delete('/contact/delete/:id', function(req, res){
    Form.findOneAndDelete({
        _id: req.params.id,
    }).then(() => {
        console.log("Data deleted")
        res.redirect('/');
    }).catch(err => console.log(err));
})

//END CONTACT ROUTES

//----------------------------------------------------------------



   

//----------------------------------------------------------------
//Modèle USER :

//Inscription
app.post('/api/signin', function (req, res){
    const Data = new User({
        username : req.body.username,
        email : req.body.email,
        password : bcrypt.hashSync(req.body.password, 10),
        admin: false
    });

    Data.save().then(() => {
        console.log("Utilisateur sauvergardé !");
        res.redirect('/login');
    }).catch(err => {console.log(err)});

});

//Affichage formulaire inscription
app.get('/signin', function(req, res){
    res.render('Signin')
})
//Affichage formulaire connexion
app.get('/login', function(req, res){
    res.render('Login')
})

app.post('/api/login', function(req, res){
    console.log(req.body);
    
    User.findOne(
        {   username : req.body.username
        }
    )
    .then( user => {
    if(!user){
        res.status(404).send('No user found');
    }
    console.log(user);
    // if(user.password != req.body.password ){
    //     res.status(404).send('Invalid password');
    // }
    if(!bcrypt.compareSync(req.body.password, user.password)){
        res.status(404).send('Invalid password');
    }

// Token jeton-connexion
    //jeton personnalisé
    const accessToken = createTokens(user);

//durée d'accèss au site 
    res.cookie("accessToken", accessToken, {
        // maxAge:1000 ms *60s * 60m * 24h * 30j,// 30 jours, 1000 en milisecondes
        httpOnly: true
    });
    // res.json("LOGGED IN")

    res.render('Userpage', {data : user})
    })
    .catch(err =>console.log(err));
});

    app.get('/logout',(req, res) =>{
        // 1 er methode logout
        res.clearCookie('accessToken');
    res.redirect('http://localhost:3000/')
 });

// 2 er methode logout
// app.get('/logout',(req, res) =>{
//     res.clearCookie('accessToken');
//     res.json("LOG OUT");
// })

app.get('/getJWT', function (req, res){
    res.json(req.cookies.accessToken)
})

app.get('/', validateToken, function (req, res) {

    User.find().then((data) => {
        res.json({data : data});
    })

});



var server = app.listen(5000, function(){
    console.log('server listening on port 5000');
})

