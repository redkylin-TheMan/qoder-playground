#!/usr/bin/env python
"""Tkinter desktop UI for doc_to_md.py."""

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from doc_to_md import ConversionError, convert_file


class DocToMarkdownApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("DOC/DOCX 转 Markdown")
        self.minsize(760, 520)

        self.input_var = tk.StringVar()
        self.output_var = tk.StringVar(value=str((Path.cwd() / "output").resolve()))
        self.md_name_var = tk.StringVar()
        self.image_dir_var = tk.StringVar()
        self.status_var = tk.StringVar(value="请选择 Word 文件")
        self.last_output_dir = None
        self.log_queue = queue.Queue()
        self.worker = None

        self._configure_style()
        self._build_ui()
        self.after(100, self._drain_log_queue)

    def _configure_style(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Title.TLabel", font=("Segoe UI", 16, "bold"))
        style.configure("Hint.TLabel", foreground="#5f6368")
        style.configure("Primary.TButton", padding=(14, 8))

    def _build_ui(self):
        frame = ttk.Frame(self, padding=18)
        frame.grid(row=0, column=0, sticky="nsew")
        frame.columnconfigure(1, weight=1)
        frame.rowconfigure(8, weight=1)

        title = ttk.Label(frame, text="Word 转 Markdown", style="Title.TLabel")
        title.grid(row=0, column=0, columnspan=3, sticky="w")
        hint = ttk.Label(
            frame,
            text="读取正文、标题、表格和图片，图片会导出到单独文件夹并在 Markdown 中相对引用。",
            style="Hint.TLabel",
        )
        hint.grid(row=1, column=0, columnspan=3, sticky="w", pady=(4, 18))

        self._add_path_row(frame, 2, "Word 文件", self.input_var, self._choose_input)
        self._add_path_row(frame, 3, "输出目录", self.output_var, self._choose_output)

        ttk.Label(frame, text="MD 文件名").grid(row=4, column=0, sticky="w", pady=6)
        ttk.Entry(frame, textvariable=self.md_name_var).grid(
            row=4, column=1, columnspan=2, sticky="ew", pady=6
        )

        ttk.Label(frame, text="图片文件夹").grid(row=5, column=0, sticky="w", pady=6)
        ttk.Entry(frame, textvariable=self.image_dir_var).grid(
            row=5, column=1, columnspan=2, sticky="ew", pady=6
        )

        note = ttk.Label(
            frame,
            text="文件名和图片文件夹留空时，会自动使用原文档名称。",
            style="Hint.TLabel",
        )
        note.grid(row=6, column=1, columnspan=2, sticky="w", pady=(0, 12))

        button_row = ttk.Frame(frame)
        button_row.grid(row=7, column=0, columnspan=3, sticky="ew", pady=(0, 12))
        button_row.columnconfigure(3, weight=1)

        self.convert_button = ttk.Button(
            button_row,
            text="开始转换",
            command=self._start_conversion,
            style="Primary.TButton",
        )
        self.convert_button.grid(row=0, column=0, sticky="w")

        self.open_button = ttk.Button(
            button_row,
            text="打开输出目录",
            command=self._open_output_dir,
            state=tk.DISABLED,
        )
        self.open_button.grid(row=0, column=1, sticky="w", padx=(10, 0))

        clear_button = ttk.Button(button_row, text="清空日志", command=self._clear_log)
        clear_button.grid(row=0, column=2, sticky="w", padx=(10, 0))

        self.progress = ttk.Progressbar(button_row, mode="indeterminate")
        self.progress.grid(row=0, column=3, sticky="ew", padx=(18, 0))

        log_frame = ttk.LabelFrame(frame, text="日志", padding=8)
        log_frame.grid(row=8, column=0, columnspan=3, sticky="nsew")
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)

        self.log_text = tk.Text(log_frame, height=12, wrap="word", state=tk.DISABLED)
        self.log_text.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.log_text.configure(yscrollcommand=scrollbar.set)

        status = ttk.Label(frame, textvariable=self.status_var, style="Hint.TLabel")
        status.grid(row=9, column=0, columnspan=3, sticky="w", pady=(10, 0))

    def _add_path_row(self, parent, row, label, variable, command):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=6)
        ttk.Entry(parent, textvariable=variable).grid(row=row, column=1, sticky="ew", pady=6)
        ttk.Button(parent, text="浏览...", command=command).grid(
            row=row, column=2, sticky="ew", padx=(10, 0), pady=6
        )

    def _choose_input(self):
        path = filedialog.askopenfilename(
            title="选择 Word 文件",
            filetypes=[
                ("Word 文档", "*.docx *.doc"),
                ("DOCX 文件", "*.docx"),
                ("DOC 文件", "*.doc"),
                ("所有文件", "*.*"),
            ],
        )
        if not path:
            return
        self.input_var.set(path)
        if not self.md_name_var.get().strip():
            self.md_name_var.set("{}{}".format(Path(path).stem, ".md"))
        if not self.image_dir_var.get().strip():
            self.image_dir_var.set("{}_images".format(Path(path).stem))

    def _choose_output(self):
        path = filedialog.askdirectory(title="选择输出目录")
        if path:
            self.output_var.set(path)

    def _start_conversion(self):
        input_text = self.input_var.get().strip()
        if not input_text:
            messagebox.showwarning("缺少文件", "请先选择 .docx 或 .doc 文件。")
            return

        input_path = Path(input_text)
        output_dir = Path(self.output_var.get().strip() or "output")
        md_name = self.md_name_var.get().strip() or None
        image_dir_name = self.image_dir_var.get().strip() or None

        if not input_path.exists():
            messagebox.showwarning("文件不存在", "找不到输入文件：{}".format(input_path))
            return
        if input_path.suffix.lower() not in (".docx", ".doc"):
            messagebox.showwarning("格式不支持", "请选择 .docx 或 .doc 文件。")
            return
        if md_name and not md_name.lower().endswith(".md"):
            md_name = "{}.md".format(md_name)
            self.md_name_var.set(md_name)

        self._set_running(True)
        self._append_log("开始转换：{}".format(input_path))
        self._append_log("输出目录：{}".format(output_dir))

        self.worker = threading.Thread(
            target=self._convert_in_background,
            args=(input_path, output_dir, md_name, image_dir_name),
            daemon=True,
        )
        self.worker.start()

    def _convert_in_background(self, input_path, output_dir, md_name, image_dir_name):
        try:
            md_path, image_dir = convert_file(
                input_path,
                output_dir,
                md_name=md_name,
                image_dir_name=image_dir_name,
            )
            self.log_queue.put(("success", md_path, image_dir))
        except ConversionError as exc:
            self.log_queue.put(("error", str(exc)))
        except Exception as exc:
            self.log_queue.put(("error", "转换失败：{}".format(exc)))

    def _drain_log_queue(self):
        try:
            while True:
                message = self.log_queue.get_nowait()
                kind = message[0]
                if kind == "success":
                    _, md_path, image_dir = message
                    self.last_output_dir = Path(md_path).parent
                    self._append_log("Markdown：{}".format(md_path))
                    self._append_log("图片目录：{}".format(image_dir))
                    self._append_log("转换完成")
                    self.status_var.set("转换完成")
                    self.open_button.configure(state=tk.NORMAL)
                    self._set_running(False)
                    messagebox.showinfo("转换完成", "已生成：\n{}".format(md_path))
                elif kind == "error":
                    self._append_log(message[1])
                    self.status_var.set("转换失败")
                    self._set_running(False)
                    messagebox.showerror("转换失败", message[1])
        except queue.Empty:
            pass
        self.after(100, self._drain_log_queue)

    def _set_running(self, running):
        if running:
            self.convert_button.configure(state=tk.DISABLED)
            self.open_button.configure(state=tk.DISABLED)
            self.progress.start(12)
            self.status_var.set("正在转换...")
        else:
            self.convert_button.configure(state=tk.NORMAL)
            self.progress.stop()

    def _append_log(self, text):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, "{}\n".format(text))
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _open_output_dir(self):
        target = self.last_output_dir or Path(self.output_var.get().strip() or "output")
        target = target.resolve()
        if not target.exists():
            messagebox.showwarning("目录不存在", "找不到输出目录：{}".format(target))
            return
        try:
            if sys.platform.startswith("win"):
                os.startfile(str(target))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(target)])
            else:
                subprocess.Popen(["xdg-open", str(target)])
        except Exception as exc:
            messagebox.showerror("打开失败", str(exc))


def main():
    app = DocToMarkdownApp()
    app.mainloop()


if __name__ == "__main__":
    main()
