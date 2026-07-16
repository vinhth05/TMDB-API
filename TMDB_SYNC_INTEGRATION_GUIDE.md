# TMDB Support API - Full Integration & API Reference Guide

Tài liệu này cung cấp toàn bộ đặc tả API (API Specifications) chi tiết cho **TMDB Sync API** và hướng dẫn cụ thể cách **Movie Service** tích hợp với các API này để thiết lập luồng đồng bộ tự động.

---

## BẢNG CHỈ MỤC API (ENDPOINTS)

*(Lưu ý: Header `x-api-key: lorafilm-secret-key` có thể được yêu cầu tùy vào cấu hình Auth Middleware hiện tại).*

### 1. Quét Toàn Bộ Kho Phim (Bulk Export)
Dùng để quét toàn bộ dữ liệu phim trên TMDB (hơn 1 triệu phim). API sử dụng kỹ thuật stream file nén từ TMDB, giúp tiết kiệm bộ nhớ Server.

- **Endpoint:** `GET /api/tmdb/export`
- **Query Parameters:**
  - `cursor` (int): Vị trí bắt đầu quét (mặc định: `0`).
  - `limit` (int): Số lượng phim muốn quét trong đợt này (mặc định: `20`, không nên vượt quá 50 để tránh block).
- **Response Format (200 OK):**
  ```json
  {
      "cursor": 0,
      "nextCursor": 20,
      "limit": 20,
      "hasMore": true,
      "movies": [
          {
              "tmdbId": 550,
              "lastUpdated": "2026-07-16T14:00:00.000Z",
              "qualityScore": 95,
              "qualityStatus": "ACCEPT",
              "movie": {
                  "tmdbId": 550,
                  "title": "Fight Club",
                  "originalTitle": "Fight Club",
                  "overview": "A ticking-time-bomb insomniac...",
                  "posterPath": "/pB8O4LaSqru31CpKvYaE3cOSjD.jpg",
                  "backdropPath": "/rr7E0NoGKxjbkb89eZ1NwPuec.jpg",
                  "releaseDate": "1999-10-15",
                  "runtime": 139,
                  "genres": [
                      { "tmdbGenreId": 18, "name": "Drama" }
                  ],
                  "cast": [
                      { "tmdbPersonId": 819, "name": "Edward Norton", "character": "The Narrator", "order": 0, "profileUrl": "..." }
                  ],
                  "director": {
                      "tmdbPersonId": 7467,
                      "name": "David Fincher",
                      "job": "Director"
                  },
                  "productionCompanies": [
                      { "tmdbCompanyId": 508, "name": "Regency Enterprises" }
                  ],
                  "trailer": {
                      "site": "YouTube",
                      "key": "O1nDozs-lOA",
                      "url": "https://www.youtube.com/watch?v=O1nDozs-lOA"
                  },
                  "imdbId": "tt0137523",
                  "voteAverage": 8.4,
                  "voteCount": 28000,
                  "popularity": 90.5
              }
          }
      ]
  }
  ```

---

### 2. Lấy Phim Mới Được Tạo (Latest)
Lấy danh sách các bộ phim vừa được hệ thống TMDB khởi tạo.

- **Endpoint:** `GET /api/tmdb/movies/latest`
- **Query Parameters:** *Không có*
- **Response Format (200 OK):**
  ```json
  {
      "success": true,
      "movies": [
          {
              "tmdbId": 1234567,
              "lastUpdated": "2026-07-16T14:30:00.000Z",
              "qualityScore": 85,
              "qualityStatus": "ACCEPT",
              "movie": {
                  // Cấu trúc Movie giống API Export
              }
          }
      ]
  }
  ```

---

### 3. Lấy Phim Vừa Cập Nhật (Updated)
Lấy thông tin của các phim vừa có sự thay đổi về nội dung, hình ảnh, hoặc meta data trên TMDB.

- **Endpoint:** `GET /api/tmdb/movies/updated`
- **Query Parameters:**
  - `page` (int): Số trang (mặc định: `1`). Max 1000 trang.
  - `startDate` (string - Optional): Ngày bắt đầu lấy dữ liệu thay đổi. Định dạng `YYYY-MM-DD`.
  - `endDate` (string - Optional): Ngày kết thúc lấy dữ liệu thay đổi. Định dạng `YYYY-MM-DD`.
  *(Lưu ý: `startDate` và `endDate` không được cách nhau quá 14 ngày. Nếu không truyền, mặc định lấy trong 24 giờ qua).*
- **Response Format (200 OK):**
  ```json
  {
      "success": true,
      "page": 1,
      "hasMore": true,
      "movies": [
          {
              "tmdbId": 299534,
              "lastUpdated": "2026-07-16T14:45:00.000Z",
              "qualityScore": 100,
              "qualityStatus": "ACCEPT",
              "movie": {
                  // Cấu trúc Movie giống API Export
              }
          }
      ]
  }
  ```

---

### 4. Đồng Bộ Phim Cụ Thể (By ID)
Lấy dữ liệu chuẩn hóa của 1 bộ phim bất kỳ, đã được chấm điểm chất lượng tự động.

- **Endpoint:** `GET /api/tmdb/movies/{tmdbId}`
- **Path Parameters:**
  - `tmdbId` (int): ID của phim trên TMDB (Ví dụ: `550`).
- **Response Format (200 OK - Nếu phim đạt chuẩn >= 70đ):**
  ```json
  {
      "success": true,
      "data": {
          "tmdbId": 550,
          "lastUpdated": "2026-07-16T15:00:00.000Z",
          "qualityScore": 95,
          "qualityStatus": "ACCEPT",
          "movie": {
              // Cấu trúc Movie giống API Export
          }
      }
  }
  ```
- **Response Format (404 Not Found - Nếu phim < 70đ HOẶC không tồn tại):**
  ```json
  {
      "success": false,
      "message": "Movie not found or rejected by quality checker"
  }
  ```

---
---

## HƯỚNG DẪN TÍCH HỢP CHO "MOVIE SERVICE"

Vì **TMDB Support API (Project này)** hoàn toàn KHÔNG kết nối tới Database, **Movie Service** bắt buộc phải tự đảm nhận các công việc sau để luồng đồng bộ hoạt động:

### 1. Cơ Chế Lưu Dữ Liệu (Upsert Flow)
Khi Movie Service nhận được dữ liệu 1 bộ phim (từ mảng `movies`), nó cần thực thi đoạn giả mã (pseudo-code) sau:

```javascript
// 1. Tìm phim trong Database của Movie Service
let existingMovie = DB.find("SELECT * FROM movies WHERE tmdb_id = ?", movieData.tmdbId);

if (!existingMovie) {
    // 2. Nếu CHƯA CÓ -> Lưu mới
    DB.execute("INSERT INTO movies (...) VALUES (...)", movieData.movie);
    DB.execute("UPDATE metadata SET last_updated = ?", movieData.lastUpdated);
} 
else {
    // 3. Nếu ĐÃ CÓ -> Kiểm tra có cần Update không
    if (movieData.lastUpdated > existingMovie.last_updated) {
        // Data trên TMDB mới hơn -> Cập nhật
        DB.execute("UPDATE movies SET ... WHERE tmdb_id = ?", movieData.movie, movieData.tmdbId);
        DB.execute("UPDATE metadata SET last_updated = ? WHERE tmdb_id = ?", movieData.lastUpdated, movieData.tmdbId);
    } else {
        // Data không đổi -> Bỏ qua (SKIP) để tiết kiệm CPU/Database
        console.log("SKIP: Phim chưa có gì mới.");
    }
}
```

### 2. Kịch Bản 1: Bulk Import (Lấy toàn bộ phim)
**Mục đích:** Cào toàn bộ 1 triệu+ phim của TMDB lúc khởi tạo hệ thống.
**Cách làm:** Viết 1 file script (hoặc vòng lặp) trên Movie Service:
1. Gọi `GET /api/tmdb/export?cursor=0&limit=50`.
2. Insert 50 phim trả về vào Database.
3. Lấy biến `nextCursor` từ response, tiếp tục gọi vòng lặp `GET /api/tmdb/export?cursor=50&limit=50`.
4. Vòng lặp chỉ dừng khi API trả về `hasMore: false`.

### 3. Kịch Bản 2: Daily Sync (Đồng bộ hàng ngày)
**Mục đích:** Giữ cho kho phim luôn mới (phim mới ra rạp, phim cũ có cập nhật điểm IMDb/Trailer).
**Cách làm:** Tạo Cronjob trên Movie Service chạy mỗi ngày 1 lần vào ban đêm.
1. Cronjob 1: Gọi `GET /api/tmdb/movies/latest` để lấy các phim vừa được cộng đồng TMDB thêm vào hệ thống hôm nay -> Insert.
2. Cronjob 2: Gọi `GET /api/tmdb/movies/updated?startDate=YYYY-MM-DD` (ngày hôm qua) để quét các thay đổi (sửa poster, đổi trailer...) -> Update.

### 4. Kịch Bản 3: Fix Lỗi (Thêm tay)
**Mục đích:** Admin phát hiện 1 phim đang thiếu trên hệ thống và muốn thêm khẩn cấp.
**Cách làm:** Movie Service làm 1 nút UI trên Admin Panel cho nhập TMDB ID. Khi bấm nút, Movie Service gọi `GET /api/tmdb/movies/{id}`. Nhận JSON xịn về và tự động Insert vào DB ngay lập tức. Nếu API trả 404, báo lỗi cho Admin "Phim chất lượng quá kém, không được phép thêm".
