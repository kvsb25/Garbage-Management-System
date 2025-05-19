const jwt = require('jsonwebtoken');
const ExpressError = require('./error');
const User = require('./database/model/user');
const redis = require('./redis/redis.js');
const constants = require('./constants');
const {forRole} = require('./utils/miscellaneous.js');

const verifyUser = async (req, res, next) => {
    const token = req.signedCookies.token;
    if (!token) {throw new ExpressError(401, 'Unauthorized')}

    const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

    if(user){
        req.user = await redis.getOrSetCache(`${user.role}:${user._id}`, async ()=>{
            const data = await User.findOne({username: user.username}).select(forRole(user.role)).lean(); // storing plain javascript object in req.user and cache
            return data;
        }, constants.redis.DEFAULT_EXPIRATION);

        console.log(req.user);
    } else {
        throw new ExpressError(401, 'Unauthorized');
    }
    
    return next();
}

const verifyRole = (role)=>{
    return (req, res, next)=>{
        console.log("verifyRole, role: ", role);
        console.log("verifyRole, req.user.role: ", req.user.role);
        if(req.user.role == role){
            return next();
        } else {
            throw new ExpressError(403, 'Forbidden, incorrect role');
        }
    }
}

module.exports = {
    verifyUser,
    verifyRole
}