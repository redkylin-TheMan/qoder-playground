import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;

public class CountHexSequence {
    public static void main(String[] args) {
        String filePath = "serial.log";
        String targetSequence = "02 2B 30 30 30 30 30 30 30 31 42 03";
        int count = 0;

        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                int index = 0;
                while ((index = line.indexOf(targetSequence, index)) != -1) {
                    count++;
                    index += targetSequence.length();
                }
            }
            System.out.println("目标序列出现的次数: " + count);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}