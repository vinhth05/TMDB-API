# Hướng Dẫn Sử Dụng TMDB-API & Cấu Trúc Dữ Liệu Trả Về (JSON)

Tài liệu này cung cấp chi tiết về các API quan trọng nhất của hệ thống **TMDB-API**, bao gồm các tham số đầu vào và **cấu trúc JSON trả về mẫu** để đội ngũ Frontend và các dịch vụ khác (như Java Movie Service) dễ dàng tích hợp.

---

## Cấu Trúc Phản Hồi Chung (Standard Response Format)

Tất cả các API (ngoại trừ `/health`) đều tuân theo chuẩn cấu trúc JSON sau:

```json
{
  "success": true,
  "data": { 
    // Dữ liệu chính của API nằm ở đây (có thể là Object hoặc Array)
  },
  "pagination": { // (Tùy chọn) Chỉ xuất hiện ở các API có phân trang
    "page": 1,
    "pageSize": 20,
    "totalPages": 50,
    "totalResults": 1000,
    "hasNext": true,
    "hasPrevious": false
  },
  "meta": { 
    "timestamp": "2026-07-19T03:00:00.000Z" 
  }
}
```

---

## 1. Nhóm API Đồng Bộ (TMDB Sync)

Nhóm này dùng để tự động cào (crawl) và đồng bộ phim từ TMDB về hệ thống.

### 1.1 Lấy danh sách phim mới nhất (Latest Verified)
- **`GET /api/tmdb/movies/latest`**
- **Chức năng:** Trả về danh sách phim chất lượng cao mới nhất vừa được thêm vào hệ thống cache ngầm. Tốc độ cực nhanh.
- **JSON Trả về mẫu:**
```json
{
  "success": true,
  "movies": [
    {
      "tmdbId": 123456,
      "title": "Tên Phim Việt Hóa",
      "originalTitle": "Original Movie Title",
      "posterPath": "/path_to_poster.jpg",
      "backdropPath": "/path_to_backdrop.jpg",
      "overview": "Mô tả nội dung bộ phim...",
      "releaseDate": "2024-05-10",
      "popularity": 1500.5,
      "voteAverage": 8.5,
      "qualityScore": 85,
      "source": "VERIFIED"
    }
  ]
}
```

### 1.2 Xuất dữ liệu phim đồng loạt (Export/Sync)
- **`GET /api/tmdb/export?cursor=0&limit=10`**
- **Chức năng:** Quét file dump ID của TMDB và trả về thông tin full bundle của phim, có lọc chất lượng.
- **JSON Trả về mẫu:**
```json
{
  "cursor": 0,
  "nextCursor": 10,
  "limit": 10,
  "hasMore": true,
  "movies": [
    {
      "tmdbId": 98765,
      "lastUpdated": "2026-07-19T10:00:00.000Z",
      "qualityScore": 90,
      "qualityStatus": "ACCEPT",
      "movie": { /* Thông tin cơ bản của phim */ },
      "genres": [ { "tmdbGenreId": 28, "name": "Hành Động" } ],
      "credits": { /* Đạo diễn, diễn viên... */ },
      "media": { /* Poster, backdrop... */ },
      "videos": { /* Trailer, Teaser... */ },
      "metadata": { "provider": "TMDB", "language": "vi-VN" }
    }
  ]
}
```

---

## 2. Nhóm API Import Chi Tiết (Protected / Yêu cầu API Key)

Yêu cầu header: `x-api-key: <your-api-key>`. Nhóm này lấy data vô cùng chi tiết.

### 2.1 Lấy toàn bộ thông tin (Bundle) của 1 bộ phim
- **`GET /api/import/movies/{tmdbId}/bundle`**
- **Chức năng:** Kéo TOÀN BỘ dữ liệu của một phim trong một lần gọi API.
- **JSON Trả về mẫu (`data`):**
```json
{
  "movie": {
    "tmdbId": 533535,
    "imdbId": "tt10872600",
    "title": "Deadpool & Wolverine",
    "originalTitle": "Deadpool & Wolverine",
    "tagline": "Everyone deserves a happy ending.",
    "overview": "Deadpool được TVA mời vào MCU...",
    "originalLanguage": "en",
    "runtimeMinutes": 128,
    "releaseDate": "2024-07-24",
    "adult": false,
    "budget": 200000000,
    "revenue": 1000000000,
    "popularity": 8500.5,
    "voteAverage": 7.9,
    "voteCount": 3500,
    "poster": { "url": "https://image.tmdb.org/t/p/w500/poster.jpg" },
    "backdrop": { "url": "https://image.tmdb.org/t/p/w500/bg.jpg" }
  },
  "genres": [
    { "tmdbGenreId": 28, "name": "Hành Động" },
    { "tmdbGenreId": 35, "name": "Hài" }
  ],
  "credits": {
    "directors": [
      { "tmdbPersonId": 17825, "name": "Shawn Levy", "profileUrl": "..." }
    ],
    "mainCast": [
      { "tmdbPersonId": 10859, "name": "Ryan Reynolds", "character": "Wade Wilson / Deadpool", "order": 0, "profileUrl": "..." },
      { "tmdbPersonId": 6968, "name": "Hugh Jackman", "character": "Logan / Wolverine", "order": 1, "profileUrl": "..." }
    ]
  },
  "videos": {
    "primaryTrailer": {
      "name": "Official Trailer",
      "key": "73_1biulkYk",
      "url": "https://www.youtube.com/watch?v=73_1biulkYk",
      "embedUrl": "https://www.youtube.com/embed/73_1biulkYk",
      "official": true
    }
  },
  "releaseInfo": {
    "preferredCountry": "VN",
    "preferredRelease": {
      "country": "VN",
      "releaseDate": "2024-07-26T00:00:00.000Z",
      "releaseType": { "code": 3, "name": "Theatrical" },
      "suggestedLoraFilmAgeRating": "T18"
    }
  },
  "metadata": {
    "provider": "TMDB",
    "language": "vi-VN",
    "fetchedAt": "2026-07-19T03:00:00.000Z"
  }
}
```

### 2.2 Tìm kiếm phim (Search)
- **`GET /api/import/search?keyword=avengers&page=1`**
- **JSON Trả về mẫu (`data`):**
```json
[
  {
    "tmdbId": 299534,
    "title": "Avengers: Hồi Kết",
    "originalTitle": "Avengers: Endgame",
    "overview": "Sau những tàn phá thảm khốc của Thanos...",
    "releaseDate": "2019-04-24",
    "releaseYear": 2019,
    "posterUrl": "https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
    "genreIds": [12, 878, 28],
    "popularity": 150.5,
    "voteAverage": 8.3
  }
]
```

---

## 3. Nhóm API Public (Client/Frontend)

Nhóm này mở cho Frontend gọi trực tiếp không cần Key.

### 3.1 Danh sách top 20 phim mới nhất (Trang chủ)
- **`GET /api/tmdb/movies/latest-top20`**
- **Chức năng:** Trả về 20 phim (gồm phim mới phát hành đã verified, bù thêm phim sắp chiếu nếu thiếu).
- **JSON Trả về mẫu:** Tương tự cấu trúc của `GET /api/tmdb/movies/latest` ở phần 1.1.

### 3.2 Gợi ý tìm kiếm (Autocomplete Suggestions)
- **`GET /api/search/keyword?keyword=batman`**
- **Chức năng:** Trả về danh sách phim rút gọn để hiển thị nhanh trên thanh tìm kiếm.
- **JSON Trả về mẫu (`data`):**
```json
[
  {
    "tmdbId": 414906,
    "title": "The Batman",
    "releaseYear": 2022,
    "posterThumbnailUrl": "https://image.tmdb.org/t/p/w185/74xTEgt7R36Fpooo50r9T25onhq.jpg"
  },
  {
    "tmdbId": 272,
    "title": "Batman Begins",
    "releaseYear": 2005,
    "posterThumbnailUrl": "https://image.tmdb.org/t/p/w185/4MpN4kIEqUjW8OPtOQJXlTdHiJV.jpg"
  }
]
```

### 3.3 Danh sách Thể loại (Genres)
- **`GET /api/genres`**
- **JSON Trả về mẫu (`data`):**
```json
{
  "genres": [
    {
      "tmdbGenreId": 28,
      "name": "Phim Hành Động",
      "mappingStatus": "UNMAPPED"
    },
    {
      "tmdbGenreId": 35,
      "name": "Phim Hài",
      "mappingStatus": "UNMAPPED"
    }
  ]
}
```

---
*Ghi chú: Để biết thêm về tham số và các Error Code, hãy truy cập giao diện Swagger UI tại `/api-docs` khi server đang chạy.*
