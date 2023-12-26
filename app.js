const express = require('express');
const exphbs = require('express-handlebars');
const session = require('express-session');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const https = require('https');
const fs = require('fs');
const path = require('path'); // path 모듈 추가

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();

const options = {
  key : fs.readFileSync("./config/cert.key"),
  cert : fs.readFileSync("./config/cert.crt"),
};

app.use(session({
  secret: '0321', // 세션 암호화에 사용할 키
  resave: false,
  saveUninitialized: true
}));

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');
app.use(cookieParser());


const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '0321',
  database: 'sharecare'
};

const db = mysql.createConnection(dbConfig);
const util = require('util');
const dbQuery = util.promisify(db.query).bind(db);

db.connect(err => {
  if (err) {
    console.error('MySQL 연결 오류:', err);
  } else {
    console.log('MySQL 연결 성공');
  }
});



app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());


// public 폴더의 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

app.get('/signup', (req, res) => {
  res.sendFile(__dirname + '/signup.html');
});

app.post('/login', (req, res) => {
  const { uid, upass } = req.body;
  const query = 'SELECT * FROM members WHERE uid = ? AND upass = ?';
  db.query(query, [uid, upass], (err, results) => {
    if (err) {
      console.error('로그인 오류: ', err);
      res.sendStatus(500);
      return;
    }

    if (results.length > 0) {
      // 로그인 성공
      const user_num = results[0].user_num;

      // memberinfo 테이블에서 unickname 가져오기
      const memberinfoQuery = 'SELECT unickname FROM memberinfo WHERE user_num = ?';
      db.query(memberinfoQuery, [user_num], (err, memberinfoResults) => {
        if (err) {
          console.error('멤버 정보 가져오기 오류: ', err);
          res.sendStatus(500);
          return;
        }

        if (memberinfoResults.length > 0) {
          const unickname = memberinfoResults[0].unickname;

          // 세션에 user_num과 unickname 저장
          req.session.user_num = user_num;
          req.session.unickname = unickname;

          // 쿠키 설정
          res.cookie('loggedIn', 'true');

          res.redirect('/index.html'); // 로그인 성공 시 리다이렉트할 페이지
        } else {
          // memberinfo에서 해당 user_num을 찾지 못한 경우 처리
          console.log('멤버 정보를 찾을 수 없습니다.');
          res.redirect('/failure.html'); // 로그인 실패 시 리다이렉트할 페이지
        }
      });
    } else {
      // 로그인 실패
      res.redirect('/failure.html'); // 로그인 실패 시 리다이렉트할 페이지
    }
  });
});

app.post('/logout', (req, res) => {
  // 세션 삭제
  req.session.destroy(err => {
      if (err) {
          res.status(500).send('Internal Server Error');
      } else {
          res.status(200).send('Logged out successfully');
      }
  });
});

app.get('/get-user-num', (req, res) => {
  if (req.session.user_num) {
    res.json({ user_num: req.session.user_num });
  } else {
    res.status(401).send('Unauthorized');
  }
});

app.post('/signup', (req, res) => {
  const { uid, upass, upass_confirm, uname, mphone, email } = req.body;
  const checkDuplicateQuery = 'SELECT * FROM members WHERE uid = ?';
  const insertQuery = 'INSERT INTO members (uid, upass, uname, mphone, email) VALUES (?, ?, ?, ?, ?)';

  if (upass !== upass_confirm) {
    return res.status(400).send('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
  }
  // 아이디 중복 체크
  db.query(checkDuplicateQuery, [uid], (err, results) => {
    if (err) {
      console.error('중복 체크 오류: ', err);
      res.sendStatus(500);
      return;
    }

    if (results.length > 0) {
      // 중복된 아이디
      res.send('아이디가 이미 존재합니다.');
    } else {
      // 중복되지 않은 아이디
      db.query(insertQuery, [uid, upass, uname, mphone, email], (err) => {
        if (err) {
          console.error('회원가입 오류: ', err);
          res.sendStatus(500);
          return;
        }

        res.redirect('/003.join/join.html');
      });
    }
  });
});

app.post('/join', (req, res) => {
  const { height, weight, chk_info, unickname } = req.body;
  const insertQuery = 'INSERT INTO memberinfo (height, weight, chk_info, unickname) VALUES (?, ?, ?, ?)';

  db.query(insertQuery, [height, weight, chk_info, unickname], (err) => {
    if (err) {
      console.error('데이터베이스 쿼리 오류:', err); // 오류 출력
      res.status(500).json({ error: '데이터베이스 오류' });
    } else {
      console.log('데이터베이스에 데이터 삽입 성공');
      res.redirect('/003.join/submit_progress.html');
    }
  });

});

app.get('/get-unickname', (req, res) => {
  res.json({ unickname: req.session.unickname });
});

//마이페이지
app.get('/mypage', (req, res) => {
  const userNum = req.session.user_num;
  if(!userNum) {
    res.redirect('/login.html');
    return;
  }
  // 두 개의 데이터베이스 쿼리를 연속적으로 실행
  db.query('SELECT * FROM memberinfo WHERE user_num = ?', [req.session.user_num], (error, memberRows) => {
    if (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      // 두 번째 쿼리 실행
      db.query('SELECT COUNT(*) AS count FROM board1 WHERE user_num = ?', [req.session.user_num], (boardError, boardResult) => {
        if (boardError) {
          console.error('Error:', boardError);
          res.status(500).json({ error: 'Internal Server Error' });
        } else {
          // 두 개의 쿼리 결과를 뷰로 렌더링
          res.render('mypage', { mypageList: memberRows, countboard: boardResult[0].count });
        }
      });
    }
  });
});

app.post('/api/create_record1', (req, res) => {
  const content = req.body.content;
  const user_num = req.session.user_num; // 사용자 번호 가져오기
  const unickname = req.session.unickname; // 사용자 닉네임 가져오기

  // 게시물 작성 시간 설정
  const regdate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 게시물 데이터를 데이터베이스에 삽입
  const sql = 'INSERT INTO record1 (user_num, regdate, content) VALUES (?, ?, ?)';
  db.query(sql, [user_num, regdate, content], (error, results) => {
    if (error) {
      console.error('게시물 작성 오류: ', error);
      res.json({ success: false });
    } else {
      console.log('게시물 작성 완료');
      res.json({ success: true });
    }
  });
});

app.post('/api/create_record2', (req, res) => {
  const content = req.body.content;
  const user_num = req.session.user_num; // 사용자 번호 가져오기
  const unickname = req.session.unickname; // 사용자 닉네임 가져오기

  // 게시물 작성 시간 설정
  const regdate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 게시물 데이터를 데이터베이스에 삽입
  const sql = 'INSERT INTO record2 (user_num, regdate, content) VALUES (?, ?, ?)';
  db.query(sql, [user_num, regdate, content], (error, results) => {
    if (error) {
      console.error('게시물 작성 오류: ', error);
      res.json({ success: false });
    } else {
      console.log('게시물 작성 완료');
      res.json({ success: true });
    }
  });
});

// record1에서 사용자의 활동 기록 조회
app.get('/api/get_records1', (req, res) => {
  const user_num = req.session.user_num;
  const sql = 'SELECT regdate, content FROM record1 WHERE user_num = ? ORDER BY regdate DESC LIMIT 6';
  db.query(sql, [user_num], (error, results) => {
    if (error) {
      console.error('활동 기록 조회 오류: ', error);
      res.json({ success: false, error: '활동 기록을 조회할 수 없습니다.' });
    } else {
      res.json({ success: true, records: results });
    }
  });
});

// record2에서 사용자의 식단 기록 조회
app.get('/api/get_records2', (req, res) => {
  const user_num = req.session.user_num;
  const sql = 'SELECT regdate, content FROM record2 WHERE user_num = ? ORDER BY regdate DESC LIMIT 6';
  db.query(sql, [user_num], (error, results) => {
    if (error) {
      console.error('식단 기록 조회 오류: ', error);
      res.json({ success: false, error: '식단 기록을 조회할 수 없습니다.' });
    } else {
      res.json({ success: true, records: results });
    }
  });
});

/* 게시판 1 */
app.get('/board1', async (req, res) => {
  const itemsPerPage = 20;
  const currentPage = parseInt(req.query.page) || 1;

  try {
    const totalItemsQuery = 'SELECT COUNT(board_id) AS total FROM board1';
    const totalItemsResult = await dbQuery(totalItemsQuery);
    const totalItems = totalItemsResult[0]?.total;

    if (!totalItems) {
      throw new Error('Total items count query failed');
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    startIndex = Math.max(startIndex, 0);
    const selectQuery = 'SELECT * FROM board1 ORDER BY board_id DESC LIMIT ?, ?';
    const rows = await dbQuery(selectQuery, [startIndex, itemsPerPage]);

    res.render('board1', { 
      boardList: rows, 
      totalPages: Math.ceil(totalItems / itemsPerPage) 
    });
  } catch (error) {
    console.error('게시물 조회 오류: ', error);
    res.status(500).json({ error: '게시물 조회 중 오류가 발생했습니다.' });
  }
});


app.get('/api/get_post1', (req, res) => {
  const boardId = req.query.id;
  db.query('SELECT * FROM board1 WHERE board_id = ?', [boardId], (error, results) => {
      if (error) {
          console.error('Error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
      } else {
          if (results.length > 0) {
              const post = results[0];
              const isAuthor = req.session.user_num === post.user_num; // 현재 로그인한 사용자가 작성자인지 확인
                res.json(post); // 게시글 데이터를 JSON 형식으로 응답
          } else {
              res.status(404).json({ error: 'Post not found' });
          }
      }
  });
});
//글 작성 API
app.post('/api/create_post1', upload.fields([{ name: 'photo1' }, { name: 'photo2' }, { name: 'photo3' }]), (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const user_num = req.session.user_num; // 사용자 번호 가져오기
  const unickname = req.session.unickname; // 사용자 닉네임 가져오기

  // 이미지 파일 초기화
  let photo1 = null;
  let photo2 = null;
  let photo3 = null;

  // 이미지 파일이 업로드되었는지 확인
  if (req.files['photo1'] && req.files['photo1'][0]) {
    photo1 = req.files['photo1'][0].buffer;
  }
  if (req.files['photo2'] && req.files['photo2'][0]) {
    photo2 = req.files['photo2'][0].buffer;
  }
  if (req.files['photo3'] && req.files['photo3'][0]) {
    photo3 = req.files['photo3'][0].buffer;
  }

  // 게시물 작성 시간 설정
  const regdate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 게시물 데이터를 데이터베이스에 삽입
  const sql = 'INSERT INTO board1 (writer, title, content, regdate, read_count, user_num, photo1, photo2, photo3) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [unickname, title, content, regdate, 0, user_num, photo1, photo2, photo3], (error, results) => {
    if (error) {
      console.error('게시물 작성 오류: ', error);
      res.json({ success: false });
    } else {
      console.log('게시물 작성 완료');
      res.json({ success: true });
    }
  });
});

app.post('/board1/:boardId/increase_read_count', async (req, res) => {
  try {
    const boardId = req.params.boardId;

    // 게시글 조회수 증가 쿼리 실행
    const increaseReadCountQuery = 'UPDATE board1 SET read_count = read_count + 1 WHERE board_id = ?';
    
    db.query(increaseReadCountQuery, [boardId], (err, result) => {
      if (err) {
        console.error('게시글 조회수 업데이트 오류:', err);
        throw err;
      }

      // 업데이트된 조회수를 클라이언트로 응답
      res.json({ success: true });
    });
  } catch (error) {
    console.error('게시글 조회수 증가 오류: ', error);
    res.status(500).json({ error: '게시글 조회수를 증가시키는 중 오류가 발생했습니다.' });
  }
});

app.delete('/delete-post1/:boardID', (req, res) => {
  const boardId = req.params.boardID; 

  if (!boardId) {
      res.status(400).send({ success: false, message: 'No board ID provided' });
      return;
  }

  const query = 'DELETE FROM board1 WHERE board_id = ?';
  db.query(query, [boardId], (err, result) => {
      if (err) {
          console.error('삭제 중 오류 발생: ', err);
          res.status(500).send({ success: false, message: 'Internal Server Error' });
      } else {
          res.status(200).send({ success: true, message: 'Post Deleted Successfully' });
      }
  });
});

app.get('/api/validate-user1/:boardId', (req, res) => {
  const boardId = req.params.boardId;
  const sessionUserNum = req.session.user_num || 0; // 세션에서 user_num 가져오기

  // 데이터베이스에서 게시글의 user_num 가져오기
  const query = 'SELECT user_num FROM board1 WHERE board_id = ?';
  db.query(query, [boardId], (err, results) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      if (results.length > 0) {
          const postUserNum = results[0].user_num;
          res.json({ isValidUser: (postUserNum === sessionUserNum) });
      } else {
          res.status(404).send('Post Not Found');
      }
  });
});

//게시판 아무대나눌러도 들어가지는 마법
app.get('/board1/:boardId', (req, res) => {
  const boardId = req.params.boardId;

  res.redirect(`/005.board01/board_Detail01.html?board_id=${boardId}`);
});

app.get('/api/search1', async (req, res) => {
  const option = req.query.option;
  const keyword = req.query.keyword;
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 20;
  let sql, params;

  switch (option) {
      case 'title':
          sql = 'SELECT * FROM board1 WHERE title LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      case 'content':
          sql = 'SELECT * FROM board1 WHERE content LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      default:
          sql = 'SELECT * FROM board1 WHERE title LIKE ? OR content LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, `%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
  }

  try {
    const results = await dbQuery(sql, params);
    res.json(results);
  } catch (error) {
    console.error('검색 오류: ', error);
    res.status(500).json({ error: '검색 중 오류 발생' });
  }
});

app.post('/api/add-comment1', (req, res) => {
  const { boardId, content } = req.body;
  if (!boardId || !req.session.unickname) {
    res.status(400).send('로그인하세요 또는 유효하지 않은 게시글입니다.');
    return;
  }
  const unickname = req.session.unickname; // 세션에서 unickname 가져오기
  const regdate = new Date(); // 현재 날짜 및 시간

  // 데이터베이스에 댓글 추가
  const query = 'INSERT INTO reply1 (board_id, unickname, content, regdate) VALUES (?, ?, ?, ?)';
  db.query(query, [boardId, unickname, content, regdate], (err, result) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      res.json({ success: true });
  });
});

// 댓글 목록 가져오기 API
app.get('/api/get-comments1/:boardId', (req, res) => {
  const boardId = req.params.boardId;

  // 데이터베이스에서 댓글 목록 가져오기
  const query = 'SELECT * FROM reply1 WHERE board_id = ? ORDER BY regdate DESC';
  db.query(query, [boardId], (err, results) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      res.json(results);
  });
});

//게시판2
app.get('/board2', async (req, res) => {
  const itemsPerPage = 20;
  const currentPage = parseInt(req.query.page) || 1;

  try {
    const totalItemsQuery = 'SELECT COUNT(board_id) AS total FROM board2';
    const totalItemsResult = await dbQuery(totalItemsQuery);
    const totalItems = totalItemsResult[0]?.total;

    if (!totalItems) {
      throw new Error('Total items count query failed');
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    startIndex = Math.max(startIndex, 0);
    const selectQuery = 'SELECT * FROM board2 ORDER BY board_id DESC LIMIT ?, ?';
    const rows = await dbQuery(selectQuery, [startIndex, itemsPerPage]);

    res.render('board2', { 
      boardList: rows, 
      totalPages: Math.ceil(totalItems / itemsPerPage) 
    });
  } catch (error) {
    console.error('게시물 조회 오류: ', error);
    res.status(500).json({ error: '게시물 조회 중 오류가 발생했습니다.' });
  }
});


app.get('/api/get_post2', (req, res) => {
  const boardId = req.query.id;
  db.query('SELECT * FROM board2 WHERE board_id = ?', [boardId], (error, results) => {
      if (error) {
          console.error('Error:', error);
          res.status(500).json({ error: 'Internal Server Error' });
      } else {
          if (results.length > 0) {
              const post = results[0];
              const isAuthor = req.session.user_num === post.user_num; // 현재 로그인한 사용자가 작성자인지 확인
                res.json(post); // 게시글 데이터를 JSON 형식으로 응답
          } else {
              res.status(404).json({ error: 'Post not found' });
          }
      }
  });
});
//글 작성 API
app.post('/api/create_post2', upload.fields([{ name: 'photo1' }, { name: 'photo2' }, { name: 'photo3' }]), (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const user_num = req.session.user_num; // 사용자 번호 가져오기
  const unickname = req.session.unickname; // 사용자 닉네임 가져오기

  // 이미지 파일 초기화
  let photo1 = null;
  let photo2 = null;
  let photo3 = null;

  // 이미지 파일이 업로드되었는지 확인
  if (req.files['photo1'] && req.files['photo1'][0]) {
    photo1 = req.files['photo1'][0].buffer;
  }
  if (req.files['photo2'] && req.files['photo2'][0]) {
    photo2 = req.files['photo2'][0].buffer;
  }
  if (req.files['photo3'] && req.files['photo3'][0]) {
    photo3 = req.files['photo3'][0].buffer;
  }

  // 게시물 작성 시간 설정
  const regdate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // 게시물 데이터를 데이터베이스에 삽입
  const sql = 'INSERT INTO board2 (writer, title, content, regdate, read_count, user_num, photo1, photo2, photo3) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  db.query(sql, [unickname, title, content, regdate, 0, user_num, photo1, photo2, photo3], (error, results) => {
    if (error) {
      console.error('게시물 작성 오류: ', error);
      res.json({ success: false });
    } else {
      console.log('게시물 작성 완료');
      res.json({ success: true });
    }
  });
});

app.post('/board2/:boardId/increase_read_count', async (req, res) => {
  try {
    const boardId = req.params.boardId;

    // 게시글 조회수 증가 쿼리 실행
    const increaseReadCountQuery = 'UPDATE board2 SET read_count = read_count + 1 WHERE board_id = ?';
    
    db.query(increaseReadCountQuery, [boardId], (err, result) => {
      if (err) {
        console.error('게시글 조회수 업데이트 오류:', err);
        throw err;
      }

      // 업데이트된 조회수를 클라이언트로 응답
      res.json({ success: true });
    });
  } catch (error) {
    console.error('게시글 조회수 증가 오류: ', error);
    res.status(500).json({ error: '게시글 조회수를 증가시키는 중 오류가 발생했습니다.' });
  }
});

//게시판 아무대나눌러도 들어가지는 마법
app.get('/board2/:boardId', (req, res) => {
  const boardId = req.params.boardId;

  res.redirect(`/006.board02/board_Detail01.html?board_id=${boardId}`);
});

app.get('/api/search2', async (req, res) => {
  const option = req.query.option;
  const keyword = req.query.keyword;
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 20;
  let sql, params;

  switch (option) {
      case 'title':
          sql = 'SELECT * FROM board2 WHERE title LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      case 'content':
          sql = 'SELECT * FROM board2 WHERE content LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      default:
          sql = 'SELECT * FROM board2 WHERE title LIKE ? OR content LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, `%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
  }

  try {
    const results = await dbQuery(sql, params);
    res.json(results);
  } catch (error) {
    console.error('검색 오류: ', error);
    res.status(500).json({ error: '검색 중 오류 발생' });
  }
});

app.delete('/delete-post2/:boardID', (req, res) => {
  const boardId = req.params.boardID; 

  if (!boardId) {
      res.status(400).send({ success: false, message: 'No board ID provided' });
      return;
  }

  const query = 'DELETE FROM board2 WHERE board_id = ?';
  db.query(query, [boardId], (err, result) => {
      if (err) {
          console.error('삭제 중 오류 발생: ', err);
          res.status(500).send({ success: false, message: 'Internal Server Error' });
      } else {
          res.status(200).send({ success: true, message: 'Post Deleted Successfully' });
      }
  });
});

app.get('/api/validate-user2/:boardId', (req, res) => {
  const boardId = req.params.boardId;
  const sessionUserNum = req.session.user_num || 0; // 세션에서 user_num 가져오기

  // 데이터베이스에서 게시글의 user_num 가져오기
  const query = 'SELECT user_num FROM board2 WHERE board_id = ?';
  db.query(query, [boardId], (err, results) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      if (results.length > 0) {
          const postUserNum = results[0].user_num;
          res.json({ isValidUser: (postUserNum === sessionUserNum) });
      } else {
          res.status(404).send('Post Not Found');
      }
  });
});

app.post('/api/add-comment2', (req, res) => {
  const { boardId, content } = req.body;

  if (!boardId || !req.session.unickname) {
    res.status(400).send('로그인하세요 또는 유효하지 않은 게시글입니다.');
    return;
  }
  const unickname = req.session.unickname; // 세션에서 unickname 가져오기
  const regdate = new Date(); // 현재 날짜 및 시간

  // 데이터베이스에 댓글 추가
  const query = 'INSERT INTO reply2 (board_id, unickname, content, regdate) VALUES (?, ?, ?, ?)';
  db.query(query, [boardId, unickname, content, regdate], (err, result) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      res.json({ success: true });
  });
});

// 댓글 목록 가져오기 API
app.get('/api/get-comments2/:boardId', (req, res) => {
  const boardId = req.params.boardId;

  // 데이터베이스에서 댓글 목록 가져오기
  const query = 'SELECT * FROM reply2 WHERE board_id = ? ORDER BY regdate DESC';
  db.query(query, [boardId], (err, results) => {
      if (err) {
          res.status(500).send('Internal Server Error');
          return;
      }
      res.json(results);
  });
});

//admin
app.get('/admin', async (req, res) => {
  const itemsPerPage = 20;
  const currentPage = parseInt(req.query.page) || 1;

  try {
    const totalItemsQuery = 'SELECT COUNT(user_num) AS total FROM members';
    const totalItemsResult = await dbQuery(totalItemsQuery);
    const totalItems = totalItemsResult[0]?.total;

    if (!totalItems) {
      throw new Error('Total items count query failed');
    }

    let startIndex = (currentPage - 1) * itemsPerPage;
    startIndex = Math.max(startIndex, 0);
    const selectQuery = 'SELECT * FROM members ORDER BY user_num DESC LIMIT ?, ?';
    const rows = await dbQuery(selectQuery, [startIndex, itemsPerPage]);

    res.render('admin', { 
      userList: rows, 
      totalPages: Math.ceil(totalItems / itemsPerPage) 
    });
  } catch (error) {
    console.error('게시물 조회 오류: ', error);
    res.status(500).json({ error: '게시물 조회 중 오류가 발생했습니다.' });
  }
});

app.get('/api/search3', async (req, res) => {
  const option = req.query.option;
  const keyword = req.query.keyword;
  const page = parseInt(req.query.page) || 1;
  const itemsPerPage = 20;
  let sql, params;

  switch (option) {
      case 'id':
          sql = 'SELECT * FROM members WHERE id LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      case 'uid':
          sql = 'SELECT * FROM members WHERE uid LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
      case 'uname':
          sql = 'SELECT * FROM members WHERE uname LIKE ? LIMIT ? OFFSET ?';
          params = [`%${keyword}%`, itemsPerPage, (page - 1) * itemsPerPage];
          break;
  }

  try {
    const results = await dbQuery(sql, params);
    res.json(results);
  } catch (error) {
    console.error('검색 오류: ', error);
    res.status(500).json({ error: '검색 중 오류 발생' });
  }
});

app.delete('/delete-user/:userNum', (req, res) => {
  const userNum = req.params.userNum;
  db.beginTransaction((err) => {
    if (err) {
        console.error('트랜잭션 시작 중 오류 발생: ', err);
        res.status(500).send('Internal Server Error');
        return;
    }

    // 먼저 memberinfo 테이블에서 삭제
    const deleteMemberInfoQuery = 'DELETE FROM memberinfo WHERE user_num = ?';
    db.query(deleteMemberInfoQuery, [userNum], (err, result) => {
        if (err) {
            // 오류 발생 시 롤백
            db.rollback(() => {
                console.error('memberinfo 삭제 중 오류 발생: ', err);
                res.status(500).send('Internal Server Error');
            });
            return;
        }

        // 이후 members 테이블에서 삭제
        const deleteMembersQuery = 'DELETE FROM members WHERE user_num = ?';
        db.query(deleteMembersQuery, [userNum], (err, result) => {
            if (err) {
                // 오류 발생 시 롤백
                db.rollback(() => {
                    console.error('members 삭제 중 오류 발생: ', err);
                    res.status(500).send('Internal Server Error');
                });
                return;
            }

            // 모든 작업이 성공적으로 완료된 경우 커밋
            db.commit((err) => {
                if (err) {
                    console.error('커밋 중 오류 발생: ', err);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                res.status(200).send('User Deleted Successfully');
            });
        });
    });
});
});

const port = 80;
app.listen(port, () => {
  console.log(`서버가 ${port} 포트에서 실행 중입니다.`);
});

https.createServer(options, app).listen(443, () => {
  console.log('HTTPS server started on port 443');
});
