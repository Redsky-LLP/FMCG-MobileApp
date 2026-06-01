namespace FMCG.Distribution.Application.Common;

public class Result
{
    public bool IsSuccess { get; }
    public string? Error { get; }
    public string? Message { get; }

    protected Result(bool isSuccess, string? error = null, string? message = null)
    {
        IsSuccess = isSuccess;
        Error = error;
        Message = message;
    }

    public static Result Success(string? message = null) => new(true, null, message);
    public static Result Failure(string error) => new(false, error);

    public static Result<T> Success<T>(T data, string? message = null) => Result<T>.Success(data, message);
    public static Result<T> Failure<T>(string error) => Result<T>.Failure(error);
}

public class Result<T> : Result
{
    public T? Data { get; }

    private Result(bool isSuccess, T? data, string? error, string? message)
        : base(isSuccess, error, message)
    {
        Data = data;
    }

    public static Result<T> Success(T data, string? message = null)
        => new(true, data, null, message);

    public new static Result<T> Failure(string error)
        => new(false, default, error, null);
}