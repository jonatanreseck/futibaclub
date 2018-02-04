const express = require('express')
const app = express.Router()

//controle de usuario logado
const init = connection => {
    app.use((req, res, next) => {
        if (!req.session.user) {
            res.redirect('/')
        } else {
            next()
        }
    })

    //midle q controla o acesso só para o admin
    app.get('/', async (req, res) => {
        const [groups, fields] = await connection.execute('select groups.*, groups_user.role from groups left join groups_user on groups.id = groups_user.group_id and groups_user.user_id = ?', [
            req.session.user.id
        ])
        res.render('groups', {
            groups
        })
    })

    app.get('/:id', async (req, res) => {
        const [group] = await connection.execute('select groups.*, groups_user.role from groups left join groups_user on groups_user.group_id = groups.id and groups_user.user_id = ? where groups.id = ?', [
            req.session.user.id,
            req.params.id
        ])
        const [pendings] = await connection.execute('select groups_user.*, users.name from groups_user inner join users on groups_user.user_id = users.id and groups_user.group_id = ? and groups_user.role like "pending"', [
            req.params.id
        ])
        const [games] = await connection.execute(`
        select 
          games.*, 
            guessings.result_a as guess_a, 
            guessings.result_b as guess_b,
            guessings.score 
        from games 
          left join 
            guessings 
              on games.id = guessings.games_id 
              and guessings.users_id = ? 
              and guessings.groups_id= ?`
            , [
                req.session.user.id,
                req.params.id
            ])
        res.render('group', {
            pendings,
            group: group[0],
            games
        })
    })
    //recebe um vetor da web
    app.post('/:id', async (req, res) => {
        const guessings = []
        Object
            .keys(req.body)
            .forEach(team => {
                const parts = team.split('_')
                const game = {
                    game_id: parts[1],
                    result_a: req.body[team].a,
                    result_b: req.body[team].b
                }
                guessings.push(game)
            })
        const batch = guessings.map(guess => {
            return connection.execute('insert into guessings (result_a, result_b, games_id, groups_id, users_id) values (?,?,?,?,?)', [
                guess.result_a,
                guess.result_b,
                guess.game_id,
                req.params.id,
                req.session.user.id
            ])
        })
        await Promise.all(batch)
        res.redirect('/groups/' + req.params.id)
    })

    app.get('/:id/pending/:idGU/:op', async (req, res) => {
        const [group] = await connection.execute('select * from groups left join groups_user on groups_user.group_id = groups.id and groups_user.user_id = ? where groups.id = ?', [
            req.session.user.id,
            req.params.id
        ])
        if (group.length == 0 || group[0].role != 'owner') {
            res.redirect('/groups/' + req.params.id)
        } else {
            if (req.params.op === 'yes') {
                await connection.execute('update groups_user set role = "user" where id = ? limit 1', [
                    req.params.idGU
                ])
                res.redirect('/groups/' + req.params.id)
            } else {
                await connection.execute('delete from groups_user where id = ? limit 1', [
                    req.params.idGU
                ])
                res.redirect('/groups')
            }
        }
    })

    app.get('/:id/join', async (req, res) => {
        const [rows, fields] = await connection.execute('select * from groups_user where user_id = ? and group_id = ?', [
            req.session.user.id,
            req.params.id
        ])
        if (rows.length > 0) {
            res.redirect('/groups')
        } else {
            await connection.execute('insert into groups_user (group_id, user_id, role) values (?,?,?)', [
                req.params.id,
                req.session.user.id,
                'pending'
            ])
            res.redirect('/groups')
        }
    })

    app.get('/:id/delete', async(req, res) => {
        await connection.execute('delete from groups where id = ? limit 1', [
            req.params.id
        ])
        res.redirect('/groups')
    })


    app.post('/', async (req, res) => {
        const [insertedId, insertedFields] = await connection.execute('insert into groups(nome) values(?)', [
            req.body.name
        ])
        await connection.execute('insert into groups_user (group_id, user_id, role) values (?,?,?)', [
            insertedId.insertId,
            req.session.user.id,
            'owner'
        ])
        res.redirect('/groups')
    })
    return app
}

module.exports = init