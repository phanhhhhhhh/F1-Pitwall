---
name: commit-convention
description: Quy tắc đặt tên commit message và Git identity cho project
triggers: ["commit", "git commit", "push"]
---

Khi tạo commit, LUÔN tuân theo:

1. Author: dùng git config --global user.name/email đã set sẵn trên máy — KHÔNG override bằng --author hoặc -c user.name khác
2. Format message: `<type>: <mô tả ngắn bằng tiếng Anh, thường, không dấu chấm cuối>`
   - feat: thêm tính năng mới
   - fix: fix bug
   - chore: config/setup/docs
   - refactor: sửa code không đổi behavior
   - test: thêm/sửa test
   - wip: đang làm dở
3. Dòng đầu tối đa 72 ký tự, dùng động từ hiện tại (add/fix/update — không phải added/fixed)
4. KHÔNG bao giờ dùng commit message mặc định kiểu "update files" hay "wip"
   không có nội dung cụ thể

Ví dụ đúng:
feat: add OTP verification endpoint
fix: resolve JWT token expiry on refresh

Ví dụ sai:
Update code.
asdf