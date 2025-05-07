const express = require('express')
const router = express.Router();


router.route("/")
    .get((req, res) => { })
    .patch((req, res) => { })

router.route("/ticket")
    .get((req, res) => { })
    .post((req, res) => { })
    
router.route("/ticket/:id")
    .get((req, res) => { })
    .post((req, res) => { })
    .delete((req, res) => { })


module.exports = router;