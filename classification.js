const express = require('express')
const app = express.Router()

const init = connection => {
    app.get('/', async (req, res) => {
        res.render('home')
    })

    app.get('/classification', async (req, res) =>{
        const [rank] = await connection.execute(`select 
        groups.id,nome,sum(guessings.score) as score 
            from groups
                left join
                    guessings on guessings.groups_id = groups.id
                group by guessings.groups_id
                order by score DESC;`
            )
            res.render('class', {
                rank
            })
        })
    app.get('/classification/:id', async(req, res)=>{
        const [rank] = await connection.execute(`select
            users.id,users.name,sum(guessings.score) as score
            from users
                left join guessings on guessings.users_id = users.id
            group by guessings.users_id
            order by score DESC`
        )
        res.render('class_user',{
            rank
        })
    }) 


    return app
}

module.exports = init