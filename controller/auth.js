const pool=require("../database/pool");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { 
    loginSchema,
    forgetPassword,
    changePasswordSchema,
    userSchema 
} = require("../utiles/validation");
const isAuthenticated = require("../utiles/isAuthenticated");



async function signIn_controller(req,res){
    // #swagger.tags = ['Auth']
    // #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/LoginInput' } }
    const { email, password } = req.body;

    const { error } = loginSchema.validate(req.body);

    if (error) return res.status(400).json({ message: error.details[0].message });
    
    const [results] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length === 0) return res.status(401).json({ message: "Invalid credentials" });

    const user= results[0];

    const isMatch=await bcrypt.compare(password,user.password_hash)

    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.roles }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
    }).redirect("/");
}

async function signUp_controller(req,res){
    // #swagger.tags = ['Auth']
    // #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/SignupInput' } }
    const { 
        email, 
        password,
        code,
        phone_number,
        password_confirmation,
        roles,
        firstname,
        lastname
    } = req.body;

    const {error}=await userSchema.validate(req.body)
    if(error)return res.status(400).json({message:error.details[0].message})
    //find user if found by email and phone_number

    let [results]=await pool.query('SELECT * FROM users WHERE phone_number = ? OR email = ?',[phone_number,email]);

    if(results.length>0)return res.status(400).json({message:'change your mail or password or phone'});

    const user=await isAuthenticated(req,res);

    [results]=await pool.query('SELECT * FROM users WHERE code=?',[code]);
    
    // check code if found change code
    if(results.length>0)return res.status(400).json({message:'change code'});
    
    // check confirem password
    if(password!==password_confirmation)return res.status(400).json({message:'confirm password please'});
    
    //hash password and add it
    const salt=await bcrypt.genSalt(10);

    const password_hash=await bcrypt.hash(password,salt);

    // create account
    [results]=await pool.execute(`
        INSERT INTO 
        users(first_name,last_name,email,password_hash,code,phone_number,roles)
        VALUES(?,?,?,?,?,?,?)`,
    [firstname,lastname,email,password_hash,code,phone_number, user?.roles==="admin" ? roles :'customer']);
    // if(err)return res.status(500).json({message:err.message});
    res.status(201).redirect('/');
    }


function logout_controller(req,res){
    res.clearCookie("session_token");
    res.redirect("/");
    }

async function resetPassword_controller(req,res){
    // #swagger.tags = ['Auth']
    // #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/ChangePasswordInput' } }
    const {code,current_password,new_password,confirm_password}=req.body;

    const {error}=await changePasswordSchema.validate(req.body);
    if(error)return res.status(400).json({message:error.details[0].message})

    const [results]=await pool.query('SELECT * FROM users WHERE id=?',[req.my.id]);
    
    if(results.length===0)return res.status(404).json({message:"not found account"});
    
    const user =results[0];

    let ismatch=await bcrypt.compare(new_password,user.password_hash);

    if(!ismatch)return res.status(400).json({message:'change your new password is wrong.'});

    if(user.code!==code)return res.status(400).json({message:"code not right"});

    ismatch=await bcrypt.compare(current_password,user.password_hash);

    if(!ismatch)return res.status(400).json({message:'wrong password'});

    // check confirem password
    if(new_password!==confirm_password)return res.status(400).json({message:'confirm password please'});
    
    //hash password and add it
    const salt=await bcrypt.genSalt(10);

    const password_hash=await bcrypt.hash(new_password,salt);

    await pool.execute('UPDATE users SET password_hash=? WHERE id=?',[password_hash,user.id]);
        // if(err.fatal)return res.status(500).json({message:err.message});
    
    res.clearCookie("session_token");

    res.redirect("/auth");
    }

async function forgetPassword_controller(req,res){
    // #swagger.tags = ['Auth']
    // #swagger.parameters['body'] = { in: 'body', schema: { $ref: '#/definitions/ForgetPasswordInput' } }
    const {code,new_password,confirm_password,email}=req.body;

    const {error}=await forgetPassword.validate(req.body);
    if(error)return res.status(400).json({message:error.details[0].message})

    const [results]=await pool.query('SELECT * FROM users WHERE email=?',[email]);
    if(results.length===0)return res.status(404).json({message:"not found mail"});
    const user =results[0];

    if(user.code!==code)return res.status(400).json({message:"code not right"});

    // check confirem password
    if(new_password!==confirm_password)return res.status(400).json({message:'confirm password please'});
    
    //hash password and add it
    const salt=await bcrypt.genSalt(10);

    const password_hash=await bcrypt.hash(new_password,salt);
    
    await pool.execute('UPDATE users SET password_hash=? WHERE id=?',[password_hash,user.id]);
    // if(err.fatal)return res.status(500).json({message:err.message});

    res.clearCookie("session_token");

    res.redirect("/auth");
    }

module.exports={
signIn_controller,
signUp_controller,
resetPassword_controller,
forgetPassword_controller,
logout_controller
};